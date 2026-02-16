import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { VideoProcessingConsumer } from './consumers/video-processing.consumer';
import { Video } from '../video/entities/video.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, VideoProcessingConsumer],
  exports: [WorkflowService],
})
export class WorkflowModule {}
