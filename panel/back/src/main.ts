import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { ValidationPipe } from '@nestjs/common';

// TUS required headers with correct case sensitivity
const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Accept',
  'Content-Type',
  'Upload-Offset',
  'Upload-Length',
  'Upload-Metadata',
  'Tus-Resumable',
  'Tus-Version',
  'Tus-Extension',
  'X-Requested-With',
  'X-HTTP-Method-Override',
  'Origin',
  'Content-Length',
];

const CORS_EXPOSED_HEADERS = [
  'Upload-Offset',
  'Location',
  'Upload-Length',
  'Tus-Version',
  'Tus-Resumable',
  'Tus-Max-Size',
  'Tus-Extension',
  'Upload-Metadata',
  'Content-Length',
];

async function bootstrap() {
  try {
    // Создаем директории
    await Promise.all([
      mkdir(join(__dirname, '..', 'data'), { recursive: true }),
      mkdir(join(__dirname, '..', 'uploads', 'temp'), { recursive: true }),
    ]);

    const app = await NestFactory.create(AppModule);

    // Global CORS configuration
    app.enableCors({
      origin: 'https://vod.31kz.adapto.kz',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: CORS_ALLOWED_HEADERS,
      exposedHeaders: CORS_EXPOSED_HEADERS,
      credentials: true,
      maxAge: 86400, // 24 hours
    });

    app.useGlobalPipes(new ValidationPipe());

    await app.listen(process.env.PORT ?? 3001);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

void bootstrap();
