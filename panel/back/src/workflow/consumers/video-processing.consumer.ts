import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { VideoProcessingJob } from '../workflow.service';
import {
  S3,
  S3ClientConfig,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Video } from '../../video/entities/video.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { basename } from 'path';
import { promises as fs } from 'fs';

interface CreateTranscodeResponse {
  jobId: string;
}

interface TranscodeJobResponse {
  id: string;
  name: string;
  state: 'waiting' | 'running' | 'failed' | 'completed';
  outputData?: string;
  error?: string;
}

interface TranscodeOutputData {
  assetId: string;
}

interface S3Error extends Error {
  $metadata?: unknown;
}

@Injectable()
@Processor('video-processing')
export class VideoProcessingConsumer {
  private readonly logger = new Logger(VideoProcessingConsumer.name);
  private readonly s3: S3;

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
  ) {
    this.s3 = new S3({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
      signatureVersion: 'v4',
      computeChecksums: true,
    } as S3ClientConfig);

    void this.checkS3Configuration();
  }

  private async checkS3Configuration(): Promise<void> {
    try {
      this.logger.log('Checking S3 configuration...');
      this.logger.log(`Endpoint: ${process.env.S3_ENDPOINT}`);
      this.logger.log(`Region: ${process.env.S3_REGION}`);
      this.logger.log(`Bucket: ${process.env.S3_BUCKET}`);

      const command = new HeadBucketCommand({
        Bucket: process.env.S3_BUCKET,
      });

      await this.s3.send(command);
      this.logger.log('S3 configuration is valid');
    } catch (error: unknown) {
      const err = error as Error & { $metadata?: unknown };
      this.logger.error(`S3 configuration check failed: ${err.message}`);
      if (err.$metadata) {
        this.logger.error(
          `S3 error metadata: ${JSON.stringify(err.$metadata as Record<string, unknown>)}`,
        );
      }
    }
  }

  @Process('process-video')
  async handleVideoProcessing(job: Job<VideoProcessingJob>) {
    const video = await this.videoRepository.findOne({
      where: { id: parseInt(job.data.videoId) },
    });

    if (!video) {
      throw new Error(`Video with id ${job.data.videoId} not found`);
    }

    try {
      this.logger.log(
        `Processing video job ${job.id} for video ${job.data.videoId}`,
      );

      // Update initial status
      video.processingStatus = 'processing';
      video.processingProgress = 0;
      await this.videoRepository.save(video);
      await job.progress(0);

      // Step 1: Upload video to S3
      await this.uploadToS3(job, video);

      // Step 2: Transcode video via API
      const transcodeResult = await this.transcodeVideo(job, video);

      // Step 3: Save transcode results
      await this.saveTranscodeResults(job, video, transcodeResult);

      // Mark job as completed
      video.processingStatus = 'completed';
      video.processingProgress = 100;
      await this.videoRepository.save(video);
      await job.progress(100);

      this.logger.log(`Completed processing video job ${job.id}`);
      return { success: true };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing video job ${job.id}: ${err.message}`);

      // Update error status
      video.processingStatus = 'failed';
      video.processingError = err.message;
      await this.videoRepository.save(video);

      throw error;
    }
  }

  private async uploadToS3(job: Job<VideoProcessingJob>, video: Video) {
    try {
      this.logger.log(`Starting S3 upload for video ${job.data.videoId}`);

      // Update status
      video.uploadStatus = 'uploading';
      video.processingProgress = 10;
      video.uploadProgress = 0; // Reset upload progress
      await this.videoRepository.save(video);
      await job.progress(10);

      // Check if file exists and log file details
      const stats = await fs.stat(job.data.filePath);
      this.logger.log(
        `File details: Size=${stats.size}, Path=${job.data.filePath}`,
      );

      // Create upload progress tracker
      const totalBytes = stats.size;
      let uploadedBytes = 0;
      let lastProgressUpdate = Date.now();
      const progressInterval = 2000; // Update progress every 2 seconds to avoid database load

      // Create upload progress callback
      const updateProgress = async (newBytes: number) => {
        uploadedBytes += newBytes;
        const now = Date.now();
        
        // Only update progress in database at intervals to avoid too many updates
        if (now - lastProgressUpdate >= progressInterval) {
          const percentage = Math.min(Math.floor((uploadedBytes / totalBytes) * 100), 100);
          video.uploadProgress = percentage;
          
          // Map upload progress (0-100) to overall processing progress range (10-30)
          video.processingProgress = 10 + Math.floor(percentage / 5); // 100% upload = 30% processing
          
          this.logger.log(`S3 upload progress: ${percentage}% (${uploadedBytes}/${totalBytes} bytes)`);
          
          await this.videoRepository.save(video);
          await job.progress(video.processingProgress);
          lastProgressUpdate = now;
        }
      };

      // Читаем файл в буфер
      const fileBuffer = await fs.readFile(job.data.filePath);
      const fileName = basename(job.data.filePath);
      const s3Key = `videos/${video.id}/${fileName}`;

      this.logger.log(
        `Uploading to S3 - Bucket: ${process.env.S3_BUCKET}, Key: ${s3Key}`,
      );

      // Upload to S3 using buffer instead of stream
      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: video.contentType,
        ContentLength: stats.size,
        ACL: 'public-read',
        ServerSideEncryption: 'AES256',
      });

      // Since we can't get upload progress from S3 client directly,
      // we'll simulate progress updates during upload for large files
      if (stats.size > 10 * 1024 * 1024) { // For files larger than 10MB
        const expectedUploadTime = stats.size / (5 * 1024 * 1024); // Estimate 5MB/s upload speed
        const updateInterval = Math.min(Math.floor(expectedUploadTime / 20) * 1000, 5000); // 20 updates or at most every 5 seconds
        
        // Start a timer to simulate progress updates
        const progressTimer = setInterval(async () => {
          uploadedBytes += (stats.size / 20); // Increment by 5% each time
          if (uploadedBytes >= stats.size) {
            uploadedBytes = stats.size * 0.95; // Cap at 95% until actual completion
            clearInterval(progressTimer);
          }
          
          const percentage = Math.min(Math.floor((uploadedBytes / totalBytes) * 100), 95);
          video.uploadProgress = percentage;
          video.processingProgress = 10 + Math.floor(percentage / 5);
          
          this.logger.log(`S3 upload estimated progress: ${percentage}%`);
          
          await this.videoRepository.save(video);
          await job.progress(video.processingProgress);
        }, updateInterval);
        
        // Clear timer when upload completes
        const uploadResult = await this.s3.send(uploadCommand);
        clearInterval(progressTimer);
      } else {
        // For smaller files, just upload without progress simulation
        const uploadResult = await this.s3.send(uploadCommand);
      }

      // Log completion
      this.logger.log(
        `S3 upload complete for video ${job.data.videoId}`,
      );

      // Update video record with S3 information
      video.uploadStatus = 's3';
      video.s3Key = s3Key;
      video.uploadProgress = 100;
      video.processingProgress = 30;
      await this.videoRepository.save(video);
      await job.progress(30);

      // Delete local file after successful upload
      await fs.unlink(job.data.filePath);
      this.logger.log(
        `Successfully uploaded video ${job.data.videoId} to S3 and deleted local file`,
      );
    } catch (error) {
      const err = error as S3Error;
      this.logger.error(`Failed to upload video ${job.data.videoId} to S3`);
      this.logger.error(`Error details: ${JSON.stringify(err)}`);
      if (err.$metadata) {
        this.logger.error(
          `S3 error metadata: ${JSON.stringify(err.$metadata as Record<string, unknown>)}`,
        );
      }

      video.uploadStatus = 'error';
      video.processingError = `S3 upload failed: ${err.message}`;
      await this.videoRepository.save(video);
      throw error;
    }
  }

  private async transcodeVideo(
    job: Job<VideoProcessingJob>,
    video: Video,
  ): Promise<TranscodeJobResponse> {
    try {
      this.logger.log(`Requesting transcoding for video ${job.data.videoId}`);

      // Update status
      video.processingProgress = 40;
      await this.videoRepository.save(video);
      await job.progress(40);

      // Prepare API request
      const s3Path = `s3://${video.s3Key}`;
      const requestBody = {
        inputs: [
          {
            type: 'video',
            path: s3Path,
          },
          {
            type: 'audio',
            path: s3Path,
            language: 'eng',
          },
        ],
        streams: [
          {
            type: 'video',
            codec: 'h264',
            height: 720,
          },
          {
            type: 'video',
            codec: 'h264',
            height: 480,
          },
          {
            type: 'video',
            codec: 'h264',
            height: 360,
          },
          {
            type: 'video',
            codec: 'h264',
            height: 240,
          },
          {
            type: 'video',
            codec: 'h264',
            height: 144,
          },
          {
            type: 'audio',
            codec: 'aac',
            language: 'eng',
          },
        ],
      };

      const response = await fetch(
        'https://engine.vod.31kz.adapto.kz/jobs/pipeline',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.ADAPTO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      // Log the raw response for debugging
      const responseText = await response.text();
      this.logger.log(`Transcode API response: ${responseText}`);

      if (!response.ok) {
        throw new Error(
          `Transcode API error: ${response.status} ${response.statusText}. Details: ${responseText}`,
        );
      }

      let createResult: CreateTranscodeResponse;
      try {
        createResult = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`Invalid JSON in API response: ${(error as Error).message}. Response: ${responseText}`);
      }

      if (!createResult.jobId) {
        throw new Error(`Invalid response from transcode API: missing jobId. Response: ${responseText}`);
      }
      
      this.logger.log(`Transcode job created with ID: ${createResult.jobId}`);

      // Wait for job completion
      let isComplete = false;
      let attempts = 0;
      const checkIntervalSeconds = 30; // Проверяем каждые 30 секунд
      const maxAttempts = (24 * 60 * 60) / checkIntervalSeconds; // 24 часа
      
      while (!isComplete && attempts < maxAttempts) {
        // Check job status
        const statusUrl = `https://engine.vod.31kz.adapto.kz/jobs/${createResult.jobId}`;
        this.logger.log(`Checking job status at: ${statusUrl} (attempt ${attempts + 1}/${maxAttempts})`);

        const statusResponse = await fetch(statusUrl, {
          headers: {
            Authorization: `Bearer ${process.env.ADAPTO_API_KEY}`,
          },
        });

        const statusText = await statusResponse.text();
        this.logger.log(`Job status response: ${statusText}`);

        if (!statusResponse.ok) {
          throw new Error(
            `Failed to check job status: ${statusResponse.status}. Details: ${statusText}`,
          );
        }

        let statusResult;
        try {
          statusResult = JSON.parse(statusText);
        } catch (error) {
          throw new Error(`Invalid JSON in status response: ${(error as Error).message}. Response: ${statusText}`);
        }

        if (!statusResult.state) {
          throw new Error(`Invalid status response: missing state. Response: ${statusText}`);
        }

        this.logger.log(`Processing job state: ${statusResult.state}`);

        // Update video progress based on job state
        switch (statusResult.state) {
          case 'completed':
            isComplete = true;
            video.processingProgress = 100;
            if (statusResult.outputData) {
              try {
                const outputData = JSON.parse(statusResult.outputData) as TranscodeOutputData;
                if (outputData.assetId) {
                  video.assetId = outputData.assetId;
                  this.logger.log(`Saved asset_id: ${outputData.assetId}`);
                }
              } catch (error) {
                this.logger.error(`Failed to parse outputData: ${(error as Error).message}`);
              }
            }
            break;
          case 'failed':
            throw new Error(`Transcode job failed: ${statusResult.error || 'Unknown error'}`);
          case 'waiting':
            video.processingProgress = 40;
            break;
          case 'running':
            // Более плавное увеличение прогресса для длительной обработки
            video.processingProgress = 40 + Math.floor((50 * attempts) / (maxAttempts / 4)); // Достигаем 90% за первую четверть времени
            if (video.processingProgress > 90) video.processingProgress = 90;
            break;
          default:
            this.logger.warn(`Unknown job state: ${statusResult.state}`);
            video.processingProgress = 50;
        }

        await this.videoRepository.save(video);
        await job.progress(video.processingProgress);

        if (!isComplete) {
          this.logger.log(`Job not complete, waiting ${checkIntervalSeconds} seconds before next check...`);
          await new Promise(resolve => setTimeout(resolve, checkIntervalSeconds * 1000));
          attempts++;
        }
      }

      if (!isComplete) {
        throw new Error('Transcode job timed out after 24 hours');
      }

      return {
        id: createResult.jobId,
        name: 'transcode',
        state: 'completed'
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Transcode error for video ${job.data.videoId}: ${err.message}`,
      );
      throw error;
    }
  }

  private async saveTranscodeResults(
    job: Job<VideoProcessingJob>,
    video: Video,
    transcodeResult: TranscodeJobResponse,
  ): Promise<void> {
    this.logger.log(`Saving transcode results for video ${job.data.videoId}`);

    video.processingProgress = 90;
    video.transcodeJobId = transcodeResult.id;
    video.processingMetadata = transcodeResult;

    await this.videoRepository.save(video);
    await job.progress(90);
  }
}
