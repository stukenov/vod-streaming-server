import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Запросы будут проксироваться через Next.js
});

export interface UploadUrlResponse {
  id: number;
  filename: string;
  size: number;
  uploadStatus: UploadStatus;
  processingStatus: ProcessingStatus;
  processingProgress: number;
}

export type UploadStatus = 'local' | 'uploading' | 's3' | 'error';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Video {
  id: number;
  filename: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: string;
  isLocal: boolean;
  uploadStatus: UploadStatus;
  processingStatus: ProcessingStatus;
  processingProgress: number;
  uploadProgress?: number;
  processingError?: string;
  assetId?: string;
}

export const videoApi = {
  // Get videos list
  getVideos: async () => {
    const { data } = await api.get<Video[]>('/videos');
    return data;
  },

  // Delete video
  deleteVideo: async (id: number) => {
    await api.delete(`/videos/${id}`);
  },
};