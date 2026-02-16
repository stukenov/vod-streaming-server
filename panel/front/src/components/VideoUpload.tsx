'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as tus from 'tus-js-client';

export function VideoUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setStatus('uploading');
      setError(null);

      // Create a new tus upload
      const upload = new tus.Upload(file, {
        endpoint: 'https://api.vod.31kz.adapto.kz/videos/upload',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onError: (error) => {
          console.error('Upload failed:', error);
          setStatus('error');
          setError(error.message || 'Ошибка загрузки видео');
          setIsUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(progress);
        },
        onSuccess: () => {
          setStatus('processing');
          onUploadComplete();
          
          // Reset UI after 3 seconds
          setTimeout(() => {
            setUploadProgress(0);
            setStatus('idle');
            setError(null);
            setIsUploading(false);
          }, 3000);
        },
      });

      // Start the upload
      await upload.start();
    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Ошибка загрузки видео');
      setIsUploading(false);
    }
  };

  return (
    <div 
      className="relative space-y-6 group"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
          const input = document.getElementById('file-upload') as HTMLInputElement;
          if (input) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
          }
        }
      }}
    >
      <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 group-hover:border-blue-200 group-hover:bg-blue-50/50 transition-all duration-300">
        <input
          id="file-upload"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <div className="mb-6 transform group-hover:scale-110 transition-transform duration-300">
          <Upload className="w-12 h-12 text-gray-400 group-hover:text-blue-500" />
        </div>
        <div className="text-center space-y-2 mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Загрузить видео
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Перетащите видеофайл в эту область или нажмите для выбора
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          disabled={isUploading}
          onClick={() => document.getElementById('file-upload')?.click()}
          className="min-w-[200px] bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-300"
        >
          {isUploading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span>Загрузка...</span>
            </div>
          ) : (
            'Выбрать файл'
          )}
        </Button>
      </div>
      
      {status !== 'idle' && (
        <div className="rounded-xl border bg-white p-6 shadow-sm animate-fadeIn">
          {status === 'uploading' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">
                  Загрузка на сервер
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {uploadProgress}%
                </span>
              </div>
              <Progress 
                value={uploadProgress} 
                className="h-2 bg-gray-100"
              />
            </div>
          )}
          {status === 'processing' && (
            <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="flex-shrink-0">
                <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
              </div>
              <p className="text-sm text-yellow-700">
                Видео загружено и обрабатывается в фоновом режиме
              </p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-sm text-green-700">
                Видео успешно загружено
              </p>
            </div>
          )}
          {status === 'error' && error && (
            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg border border-red-100">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 