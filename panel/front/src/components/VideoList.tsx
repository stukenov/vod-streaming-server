'use client';

import { useEffect, useState } from 'react';
import { Video, videoApi } from '@/api/video';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { VideoIcon, Play, Trash2, Copy, RefreshCw, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export function VideoList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [copiedVideoId, setCopiedVideoId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  const loadVideos = async () => {
    try {
      setIsLoading(true);
      const data = await videoApi.getVideos();
      setVideos(data);
      
      // Check if any videos are still in a processing state
      const hasProcessingVideos = data.some(v => 
        v.processingStatus === 'processing' || 
        v.uploadStatus === 'uploading'
      );
      
      // Enable or disable auto-refresh based on processing status
      setAutoRefreshEnabled(hasProcessingVideos);
      
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadVideos();
  };

  useEffect(() => {
    loadVideos();
  }, []);
  
  // Set up smart auto-refresh that only runs when videos are processing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (autoRefreshEnabled) {
      // Start periodic refresh only if there are videos being processed
      interval = setInterval(() => {
        // Don't trigger full UI refresh, just quietly update data
        const quietRefresh = async () => {
          try {
            const data = await videoApi.getVideos();
            setVideos(data);
            
            // Check if we should continue auto-refreshing
            const hasProcessingVideos = data.some(v => 
              v.processingStatus === 'processing' || 
              v.uploadStatus === 'uploading'
            );
            
            setAutoRefreshEnabled(hasProcessingVideos);
          } catch (error) {
            console.error('Auto-refresh failed:', error);
          }
        };
        
        quietRefresh();
      }, 5000); // Check every 5 seconds
      
      console.log('Auto-refresh enabled - videos are processing');
    } else {
      console.log('Auto-refresh disabled - no videos processing');
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshEnabled]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить это видео?')) return;

    try {
      await videoApi.deleteVideo(id);
      await loadVideos();
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  };

  const getEmbedUrl = (id: number) => {
    return `https://player.vod.31kz.adapto.kz/embed/${id}`;
  };

  const copyToClipboard = (id: number) => {
    const url = getEmbedUrl(id);
    navigator.clipboard.writeText(url)
      .then(() => {
        // Показываем визуальную обратную связь
        setCopiedVideoId(id);
        // Показываем уведомление
        toast.success('Ссылка скопирована в буфер обмена');
        // Сбрасываем состояние через 2 секунды
        setTimeout(() => setCopiedVideoId(null), 2000);
      })
      .catch(err => {
        console.error('Не удалось скопировать: ', err);
        toast.error('Не удалось скопировать ссылку');
      });
  };

  const getStatusIndicator = (video: Video) => {
    // Если видео в процессе обработки, показываем статус обработки
    if (video.processingStatus !== 'completed') {
      const processingConfig = {
        pending: {
          bg: 'bg-gray-50',
          dot: 'bg-gray-400',
          text: 'text-gray-600',
          label: 'Ожидает обработки',
        },
        processing: {
          bg: 'bg-yellow-50',
          dot: 'bg-yellow-500',
          text: 'text-yellow-700',
          label: 'Обработка',
        },
        failed: {
          bg: 'bg-red-50',
          dot: 'bg-red-500',
          text: 'text-red-700',
          label: 'Ошибка обработки',
        },
        completed: {
          bg: 'bg-green-50',
          dot: 'bg-green-500',
          text: 'text-green-700',
          label: 'Обработано',
        },
      };

      const config = processingConfig[video.processingStatus];

      return (
        <div className="space-y-2">
          <div className={`flex items-center space-x-2 px-3 py-1.5 ${config.bg} rounded-full`}>
            <div className={`w-2 h-2 ${config.dot} rounded-full ${video.processingStatus === 'processing' ? 'animate-pulse' : ''}`} />
            <span className={`text-sm ${config.text}`}>
              {config.label}
              {video.uploadStatus === 'uploading' && ' (Загрузка в S3)'}
            </span>
          </div>
          {video.processingStatus === 'processing' && (
            <div className="space-y-1.5">
              <div className="flex items-center text-xs text-gray-500 justify-between mb-1">
                <span>
                  {video.uploadStatus === 'uploading' 
                    ? `Загрузка в облако: ${video.uploadProgress || 0}%` 
                    : `Обработка видео: ${Math.round(video.processingProgress)}%`}
                </span>
                <span>{video.uploadStatus === 's3' ? 'Файл в облаке' : ''}</span>
              </div>
              <Progress 
                value={video.processingProgress} 
                className="h-1.5 w-[200px]"
              />
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Прогресс</span>
                <span className="text-yellow-600">
                  {Math.round(video.processingProgress)}%
                </span>
              </div>
            </div>
          )}
          {video.processingStatus === 'failed' && video.processingError && (
            <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-xs text-red-600 truncate max-w-[200px]">
                  {video.processingError}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{video.processingError}</p>
              </TooltipContent>
            </Tooltip>
            </TooltipProvider>
          )}
        </div>
      );
    }

    // Если обработка завершена, показываем статус загрузки
    const uploadConfig = {
      local: {
        bg: 'bg-gray-50',
        dot: 'bg-gray-400',
        text: 'text-gray-600',
        label: 'Локально',
      },
      uploading: {
        bg: 'bg-blue-50',
        dot: 'bg-blue-500',
        text: 'text-blue-700',
        label: 'Загрузка в облако',
      },
      error: {
        bg: 'bg-red-50',
        dot: 'bg-red-500',
        text: 'text-red-700',
        label: 'Ошибка загрузки',
      },
      s3: {
        bg: 'bg-green-50',
        dot: 'bg-green-500',
        text: 'text-green-700',
        label: 'В облаке',
      },
    };

    const config = uploadConfig[video.uploadStatus];

    return (
      <div className="space-y-1.5">
        <div className={`flex items-center space-x-2 px-3 py-1.5 ${config.bg} rounded-full`}>
          <div className={`w-2 h-2 ${config.dot} rounded-full ${video.uploadStatus === 'uploading' ? 'animate-pulse' : ''}`} />
          <span className={`text-sm ${config.text}`}>
            {config.label}
          </span>
        </div>
        {video.uploadStatus === 'uploading' && (
          <div className="space-y-1">
            <Progress 
              value={video.uploadProgress || 0} 
              className="h-1.5 w-[200px]"
            />
            <div className="text-xs text-blue-600 text-right">
              {video.uploadProgress || 0}%
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && !refreshing) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          {autoRefreshEnabled && (
            <div className="flex items-center text-sm text-gray-500">
              <RefreshCw className="w-3 h-3 mr-2 animate-spin text-blue-500" />
              <span>Авто-обновление активно</span>
            </div>
          )}
        </div>
        <Button 
          variant="outline" 
          className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Обновить список
        </Button>
      </div>
      
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
          <div className="mb-6 p-6 bg-gray-50 rounded-full">
            <VideoIcon className="w-16 h-16 text-gray-300" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Нет загруженных видео
          </h3>
          <p className="text-sm text-gray-500">
            Загрузите свое первое видео, перетащив его в область выше
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="group flex items-center justify-between p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-200 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center space-x-4 min-w-[400px]">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors duration-300">
                  <VideoIcon className="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                </div>
                <div className="space-y-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <h3 className="font-medium text-gray-900 line-clamp-1 text-left">
                          {video.filename}
                        </h3>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{video.filename}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">
                      {formatFileSize(video.size)}
                    </span>
                    {getStatusIndicator(video)}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Dialog open={dialogOpen && selectedVideo?.id === video.id} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (open) {
                    setSelectedVideo(video);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                      onClick={() => {
                        setSelectedVideo(video);
                        setDialogOpen(true);
                      }}
                      disabled={video.processingStatus !== 'completed' || !video.assetId}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Просмотр
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>{video.filename}</DialogTitle>
                    </DialogHeader>
                    <div className="aspect-video w-full mt-2">
                      <iframe 
                        src={getEmbedUrl(video.id)} 
                        className="w-full h-full border-0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                      ></iframe>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm text-gray-500">
                        Ссылка для встраивания:
                      </span>
                      <Button
                        variant="outline"
                        className="flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                        onClick={() => copyToClipboard(video.id)}
                      >
                        {copiedVideoId === video.id ? (
                          <>
                            <Check className="w-4 h-4 mr-2 text-green-500" />
                            Скопировано!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Копировать ссылку
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  className={`hover:bg-blue-50 hover:border-blue-200 ${
                    copiedVideoId === video.id 
                      ? 'bg-green-50 text-green-600 border-green-200' 
                      : 'hover:text-blue-600'
                  }`}
                  onClick={() => copyToClipboard(video.id)}
                  disabled={video.processingStatus !== 'completed' || !video.assetId}
                >
                  {copiedVideoId === video.id ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Копировать ссылку
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  onClick={() => handleDelete(video.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}