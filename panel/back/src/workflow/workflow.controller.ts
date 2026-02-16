import { Controller, Post, Get, Body, Param, Put } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('video/process')
  async startVideoProcessing(
    @Body() data: { videoId: string; filePath: string },
  ) {
    const job = await this.workflowService.startVideoProcessingWorkflow(
      data.videoId,
      data.filePath,
    );
    return {
      jobId: job.id,
      status: 'started',
    };
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.workflowService.getJobStatus(jobId);
  }

  @Put('job/:jobId/retry')
  async retryJob(@Param('jobId') jobId: string) {
    const job = await this.workflowService.retryJob(jobId);
    return {
      jobId: job?.id,
      status: job ? 'retrying' : 'not_found',
    };
  }
}
