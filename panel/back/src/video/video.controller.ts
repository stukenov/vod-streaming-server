import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  ParseIntPipe,
  BadRequestException,
  InternalServerErrorException,
  Res,
  Headers,
  All,
  Req,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { join, resolve } from 'path';
import { Response, Request } from 'express';
import { statSync } from 'fs';
import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { UploadUrlDto } from './dto/video.dto';
import { IncomingMessage, ServerResponse } from 'http';
import { mkdir } from 'fs/promises';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const UPLOAD_PATH = resolve(process.cwd(), 'uploads', 'temp');

@Controller('videos')
export class VideoController {
  private readonly tusServer: Server;

  constructor(private readonly videoService: VideoService) {
    // Ensure upload directory exists
    mkdir(UPLOAD_PATH, { recursive: true }).catch(console.error);

    // Initialize TUS server
    this.tusServer = new Server({
      path: '/videos/upload',
      datastore: new FileStore({
        directory: UPLOAD_PATH,
      }),
      respectForwardedHeaders: true, // Added this line
      // Handle upload creation
      onUploadCreate: async (req: IncomingMessage, res: ServerResponse, upload: any) => {
        const metadata = upload.metadata || {};
        if (!metadata.filename || !metadata.filetype) {
          return {
            res,
            status_code: 400,
            body: 'Missing required metadata',
          };
        }
        return { res };
      },
      // Handle upload finish
      onUploadFinish: async (req: IncomingMessage, res: ServerResponse, upload: any) => {
        try {
          const metadata = upload.metadata || {};
          const filePath = resolve(UPLOAD_PATH, upload.id);
          console.log('Upload finished. File path:', filePath); // Debug log

          await this.videoService.processVideoUpload({
            originalname: metadata.filename || 'unknown',
            path: filePath,
            size: upload.size || 0,
            mimetype: metadata.filetype || 'video/mp4',
          });
          return { res };
        } catch (error) {
          console.error('Upload processing error:', error);
          return {
            res,
            status_code: 500,
            body: 'Failed to process upload',
          };
        }
      },
    });
  }

  @Post('upload-url')
  async getUploadUrl(@Headers() headers: any) {
    try {
      return await this.videoService.createUploadUrl(headers);
    } catch (error) {
      console.error('Upload URL error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create upload URL');
    }
  }

  @All('upload')
  async handleTusUpload(@Req() req: Request, @Res() res: Response) {
    await this.tusServer.handle(req, res);
  }

  @All('upload/*')
  async handleTusUploadChunks(@Req() req: Request, @Res() res: Response) {
    await this.tusServer.handle(req, res);
  }

  @Get()
  async getAllVideos() {
    return this.videoService.getAllVideos();
  }

  @Delete(':id')
  async deleteVideo(@Param('id', ParseIntPipe) id: number) {
    return this.videoService.deleteVideo(id);
  }

  @Get('stream/:id')
  async streamVideo(
    @Param('id', ParseIntPipe) id: number,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    const video = await this.videoService.getVideoForStreaming(id);
    const videoPath = resolve(video.s3Key); // Use resolve here too
    const videoSize = statSync(videoPath).size;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.contentType,
      });

      const videoStream = createReadStream(videoPath, { start, end });
      await pipeline(videoStream, res);
    } else {
      res.writeHead(200, {
        'Content-Length': videoSize,
        'Content-Type': video.contentType,
      });

      const videoStream = createReadStream(videoPath);
      await pipeline(videoStream, res);
    }
  }
}
