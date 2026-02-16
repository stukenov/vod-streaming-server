import { IsString, IsNumber, IsOptional, IsIn, Max } from 'class-validator';

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

export class UploadUrlDto {
  @IsString()
  filename: string;

  @IsString()
  @IsIn(ALLOWED_MIME_TYPES)
  contentType: string;

  @IsNumber()
  @Max(2 * 1024 * 1024 * 1024) // 2GB
  fileSize: number;
}

export class UpdateVideoDto {
  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
