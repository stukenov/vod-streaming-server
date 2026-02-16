import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UploadStatus = 'local' | 'uploading' | 's3' | 'error';
export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: '' })
  title: string;

  @Column({ nullable: true, default: '' })
  description: string;

  @Column()
  filename: string;

  @Column({ nullable: true, default: '' })
  path: string;

  @Column({ name: 's3_key', nullable: true, default: '' })
  s3Key: string;

  @Column({ type: 'bigint', default: 0 })
  size: number;

  @Column({ nullable: true, default: 0 })
  duration: number;

  @Column({ name: 'content_type', default: 'video/mp4' })
  contentType: string;

  @Column({
    type: 'varchar',
    name: 'upload_status',
    default: 'local',
  })
  uploadStatus: UploadStatus;

  @Column({
    type: 'int',
    name: 'upload_progress',
    default: 0,
  })
  uploadProgress: number;

  @Column({
    type: 'varchar',
    name: 'processing_status',
    default: 'pending',
  })
  processingStatus: ProcessingStatus;

  @Column({
    type: 'int',
    name: 'processing_progress',
    default: 0,
  })
  processingProgress: number;

  @Column({
    type: 'text',
    name: 'processing_error',
    nullable: true,
  })
  processingError: string;

  @Column({
    type: 'json',
    name: 'processing_metadata',
    nullable: true,
  })
  processingMetadata: any;

  @Column({
    name: 'transcode_job_id',
    nullable: true,
  })
  transcodeJobId: string;

  @Column({
    name: 'asset_id',
    nullable: true,
  })
  assetId: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
