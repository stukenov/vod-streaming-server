import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { ConfigModule } from '@nestjs/config';
import { Video } from './entities/video.entity';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Video]),
    MulterModule.register({
      dest: './uploads/temp',
    }),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
    WorkflowModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
