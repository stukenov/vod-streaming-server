'use client';

import { VideoUpload } from '@/components/VideoUpload';
import { VideoList } from '@/components/VideoList';


export default function Home() {
  return (
    <main className="container mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold">Управление видео</h1>
      <VideoUpload onUploadComplete={() => window.location.reload()} />
      <VideoList />
    </main>
  );
}
