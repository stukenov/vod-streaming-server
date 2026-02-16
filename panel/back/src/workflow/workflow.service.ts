import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface VideoProcessingJob {
  videoId: string;
  filePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WorkflowService {
  constructor(
    @InjectQueue('video-processing')
    private readonly videoProcessingQueue: Queue<VideoProcessingJob>,
  ) {}

  async startVideoProcessingWorkflow(videoId: string, filePath: string) {
    try {
      const job = await this.videoProcessingQueue.add(
        'process-video',
        {
          videoId,
          filePath,
          status: 'pending',
          currentStep: 'upload',
        } as VideoProcessingJob,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      return {
        id: job.id,
        data: job.data,
        status: await job.getState(),
        progress: (await job.progress()) as number,
      };
    } catch (error) {
      console.error('Failed to start video processing workflow:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string) {
    try {
      const job = await this.videoProcessingQueue.getJob(jobId);
      if (!job) {
        return null;
      }
      return {
        id: job.id,
        data: job.data,
        status: await job.getState(),
        progress: job.progress() as number,
      };
    } catch (error) {
      console.error('Failed to get job status:', error);
      throw error;
    }
  }

  async retryJob(jobId: string) {
    try {
      const job = await this.videoProcessingQueue.getJob(jobId);
      if (job) {
        await job.retry();
      }
      return job;
    } catch (error) {
      console.error('Failed to retry job:', error);
      throw error;
    }
  }
}
