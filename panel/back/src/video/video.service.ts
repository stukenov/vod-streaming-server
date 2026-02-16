import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from './entities/video.entity';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { join, resolve } from 'path';
import { promises as fs } from 'fs';
import { basename } from 'path';

interface VideoFile {
  originalname: string;
  path: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectQueue('video-processing')
    private readonly videoProcessingQueue: Queue,
  ) {}

  async createUploadUrl(headers: any) {
    const filename = headers['x-filename'];
    const contentType = headers['x-content-type'];
    const fileSize = parseInt(headers['x-file-size'], 10);

    if (!filename || !contentType || !fileSize) {
      throw new BadRequestException('Missing required upload information');
    }

    if (!contentType.includes('video/')) {
      throw new BadRequestException('Only video files are allowed');
    }

    // Create a video record in pending state
    const video = this.videoRepository.create({
      filename,
      contentType,
      size: fileSize,
      uploadStatus: 'uploading',
      processingStatus: 'pending',
      processingProgress: 0,
    });

    await this.videoRepository.save(video);

    return {
      id: video.id,
      filename: video.filename,
      size: video.size,
      uploadStatus: 'uploading',
      processingStatus: 'pending',
      processingProgress: 0,
    };
  }

  async processVideoUpload(file: VideoFile) {
    this.logger.log(`Processing upload for file: ${file.originalname}`);

    // Normalize the path to file - use resolve to get absolute path
    const normalizedPath = resolve(file.path);
    this.logger.log(`Normalized file path: ${normalizedPath}`);

    // Find or create video record
    let video = await this.videoRepository.findOne({
      where: { filename: file.originalname },
    });

    if (!video) {
      video = this.videoRepository.create({
        filename: file.originalname,
        s3Key: normalizedPath,
        size: file.size,
        contentType: file.mimetype,
        uploadStatus: 'local',
        processingStatus: 'pending',
        processingProgress: 0,
      });
    } else {
      video.s3Key = normalizedPath;
      video.size = file.size;
      video.contentType = file.mimetype;
      video.uploadStatus = 'local';
    }

    await this.videoRepository.save(video);
    this.logger.log(`Updated video record with ID: ${video.id}`);

    try {
      // Start video processing workflow
      const job = await this.videoProcessingQueue.add('process-video', {
        videoId: video.id,
        filePath: normalizedPath,
      });
      this.logger.log(
        `Created processing job with ID: ${job.id} for video: ${video.id}`,
      );

      return {
        id: video.id,
        filename: video.filename,
        size: video.size,
        url: `/api/videos/stream/${video.id}`,
        isLocal: true,
        uploadStatus: 'local',
        processingStatus: 'pending',
        processingProgress: 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create processing job for video ${video.id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getAllVideos() {
    const videos = await this.videoRepository.find({
      order: { created_at: 'DESC' },
    });

    this.logger.log(`Fetched ${videos.length} videos. Upload statuses: ${videos.map(v => `${v.id}:${v.uploadStatus}`).join(', ')}`);

    return Promise.all(
      videos.map((video) => {
        const baseVideo = {
          id: video.id,
          filename: video.filename,
          size: video.size,
          contentType: video.contentType,
          createdAt: video.created_at,
          uploadStatus: video.uploadStatus,
          processingStatus: video.processingStatus,
          processingProgress: video.processingProgress,
          processingError: video.processingError,
          assetId: video.assetId,
          uploadProgress: video.uploadProgress || 0,
        };

        return {
          ...baseVideo,
          url: `/api/videos/stream/${video.id}`,
          isLocal: true,
        };
      }),
    );
  }

  async deleteVideo(id: number) {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Delete local file if exists
    if (video.s3Key) {
      try {
        await fs.unlink(video.s3Key);
      } catch (error) {
        this.logger.error(`Failed to delete local file: ${error.message}`);
      }
    }

    await this.videoRepository.remove(video);
    return { success: true };
  }

  async getVideoForStreaming(id: number): Promise<Video> {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (!video.s3Key) {
      throw new BadRequestException('Video is not available for streaming');
    }

    return video;
  }
}
