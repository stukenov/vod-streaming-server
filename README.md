# VOD Streaming Server

A complete Video-on-Demand (VOD) streaming platform with content management panel, video processing pipeline, and HLS player. Features resumable uploads, queue-based processing, and MySQL database.

## Features

- **Content Management**: Full-featured admin panel for video management
- **Resumable Uploads**: TUS protocol support for reliable large file uploads
- **Video Processing**: Queue-based video transcoding with Bull
- **S3 Storage**: S3-compatible object storage integration
- **HLS Streaming**: Adaptive bitrate streaming with HLS.js
- **Database**: MySQL/SQLite support with TypeORM
- **Modern Stack**: NestJS backend, Next.js frontend, Express player

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Upload     │────▶│  Processing  │────▶│  S3 Storage  │
│   (TUS)      │     │  Queue (Bull)│     │  (HLS Files) │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │                     │
        ▼                    ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Database   │◀───▶│  Admin Panel │────▶│    Player    │
│   (MySQL)    │     │  (Next.js)   │     │  (Express)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Tech Stack

### Admin Panel Backend (`/panel/back`)
- **Framework**: NestJS 11
- **Database**: TypeORM with MySQL/SQLite
- **Queue**: Bull with Redis
- **Storage**: AWS SDK S3
- **Upload**: TUS Server (resumable uploads)
- **Validation**: class-validator, class-transformer

### Admin Panel Frontend (`/panel/front`)
- **Framework**: Next.js 15 (with Turbopack)
- **UI**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Upload**: tus-js-client
- **HTTP**: Axios
- **Toast**: Sonner

### Player (`/player`)
- **Framework**: Express.js
- **Template**: EJS
- **Video**: HLS Video Element
- **Style**: player.style
- **Build**: esbuild

## Prerequisites

- Node.js 18+
- MySQL 5.7+ or SQLite
- Redis (for queue management)
- S3-compatible storage (AWS S3, MinIO, etc.)
- FFmpeg (for video processing)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/stukenov/vod-streaming-server.git
cd vod-streaming-server
```

### 2. Environment Setup

Copy example environment files:
```bash
cp .env.example panel/back/.env
cp .env.example player/.env
```

Configure `panel/back/.env`:
```env
PORT=3001

REDIS_HOST=localhost
REDIS_PORT=6379

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=vod_database

S3_REGION=your-region
S3_ENDPOINT=https://your-s3-endpoint.com
S3_BUCKET=your-bucket
S3_ACCESS_KEY=your_key
S3_SECRET_KEY=your_secret

ADAPTO_API_URL=https://your-processing-api.com
ADAPTO_API_KEY=your_api_key
```

Configure `player/.env`:
```env
PORT=4000

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=vod_database
```

### 3. Database Setup

Create database:
```bash
mysql -u root -p
CREATE DATABASE vod_database;
exit;
```

The application will auto-create tables via TypeORM migrations.

### 4. Install Dependencies

```bash
# Admin Panel Backend
cd panel/back && npm install && cd ../..

# Admin Panel Frontend
cd panel/front && npm install && cd ../..

# Player
cd player && npm install && cd ..
```

### 5. Start Services

#### Start Redis
```bash
redis-server
```

#### Start Admin Panel Backend
```bash
cd panel/back
npm run dev
```

Backend runs on `http://localhost:3001`

#### Start Admin Panel Frontend
```bash
cd panel/front
npm run dev
```

Frontend runs on `http://localhost:3000`

#### Start Player
```bash
cd player
npm run dev
```

Player runs on `http://localhost:4000`

## Project Structure

```
.
├── panel/                          # Admin Panel
│   ├── back/                       # NestJS Backend
│   │   ├── src/
│   │   │   ├── video/              # Video management
│   │   │   ├── upload/             # TUS upload handler
│   │   │   ├── queue/              # Bull job queue
│   │   │   └── storage/            # S3 integration
│   │   ├── uploads/                # Temp upload storage
│   │   └── package.json
│   │
│   └── front/                      # Next.js Frontend
│       ├── src/
│       │   ├── app/                # App router pages
│       │   ├── components/         # React components
│       │   └── lib/                # Utilities
│       └── package.json
│
├── player/                         # Video Player
│   ├── src/
│   │   ├── server.js               # Express server
│   │   ├── client/                 # Client-side JS
│   │   └── views/                  # EJS templates
│   └── package.json
│
├── .github/                        # CI/CD workflows
├── .env.example                    # Environment template
└── README.md                       # This file
```

## Features in Detail

### Video Upload

1. **Resumable Uploads**: TUS protocol allows resuming interrupted uploads
2. **Chunked Transfer**: Large files uploaded in manageable chunks
3. **Progress Tracking**: Real-time upload progress monitoring
4. **Validation**: File type, size, and format validation

### Video Processing

1. **Queue System**: Bull-based job queue for async processing
2. **HLS Transcoding**: Convert videos to HLS format with multiple bitrates
3. **Thumbnail Generation**: Auto-generate video thumbnails
4. **Status Tracking**: Monitor processing progress and status
5. **Error Handling**: Automatic retry on failures

### Video Playback

1. **HLS Streaming**: Adaptive bitrate streaming
2. **Resume Playback**: Remember viewer position
3. **Multiple Qualities**: Auto-switch based on bandwidth
4. **Responsive Player**: Works on all devices
5. **Custom Controls**: Seek, volume, fullscreen controls

## API Endpoints

### Admin Panel Backend

#### Videos
- `GET /videos` - List all videos
- `GET /videos/:id` - Get video details
- `POST /videos` - Create video entry
- `PATCH /videos/:id` - Update video
- `DELETE /videos/:id` - Delete video

#### Upload
- `POST /upload` - Create upload
- `PATCH /upload/:id` - Upload chunk (TUS)
- `HEAD /upload/:id` - Get upload status

#### Processing
- `POST /videos/:id/process` - Start processing
- `GET /videos/:id/status` - Get processing status

### Player API

- `GET /` - Home page with video list
- `GET /watch/:id` - Video player page
- `GET /api/videos` - Get videos JSON

## Environment Variables

### Backend Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Backend server port | No | 3001 |
| `REDIS_HOST` | Redis hostname | Yes | localhost |
| `REDIS_PORT` | Redis port | Yes | 6379 |
| `DB_HOST` | Database hostname | Yes | localhost |
| `DB_PORT` | Database port | Yes | 3306 |
| `DB_USERNAME` | Database username | Yes | root |
| `DB_PASSWORD` | Database password | Yes | - |
| `DB_DATABASE` | Database name | Yes | - |
| `S3_REGION` | S3 region | Yes | - |
| `S3_ENDPOINT` | S3 endpoint URL | Yes | - |
| `S3_BUCKET` | S3 bucket name | Yes | - |
| `S3_ACCESS_KEY` | S3 access key | Yes | - |
| `S3_SECRET_KEY` | S3 secret key | Yes | - |
| `ADAPTO_API_URL` | Processing API URL | No | - |
| `ADAPTO_API_KEY` | Processing API key | No | - |

### Player Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Player server port | No | 4000 |
| `DB_HOST` | Database hostname | Yes | localhost |
| `DB_PORT` | Database port | Yes | 3306 |
| `DB_USERNAME` | Database username | Yes | root |
| `DB_PASSWORD` | Database password | Yes | - |
| `DB_DATABASE` | Database name | Yes | - |

## Development

### Running in Development Mode

Admin Panel Backend:
```bash
cd panel/back
npm run dev
```

Admin Panel Frontend:
```bash
cd panel/front
npm run dev
```

Player:
```bash
cd player
npm run dev
```

### Building for Production

Admin Panel Backend:
```bash
cd panel/back
npm run build
npm run prod  # Uses PM2
```

Admin Panel Frontend:
```bash
cd panel/front
npm run build
npm run prod  # Uses PM2
```

Player:
```bash
cd player
npm run build
npm start
```

### Testing

```bash
# Backend unit tests
cd panel/back && npm test

# Backend e2e tests
cd panel/back && npm run test:e2e

# Test coverage
cd panel/back && npm run test:cov
```

## Video Processing Pipeline

1. **Upload**: User uploads video via TUS protocol
2. **Storage**: Temporary file stored locally
3. **Queue**: Processing job added to Bull queue
4. **Transcode**: FFmpeg converts to HLS format with multiple bitrates
5. **Upload**: HLS segments uploaded to S3
6. **Database**: Video metadata and status updated
7. **Cleanup**: Temporary files removed
8. **Ready**: Video available for streaming

## Deployment

### Docker (Recommended)

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  backend:
    build: ./panel/back
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - mysql
      - redis

  frontend:
    build: ./panel/front
    ports:
      - "3000:3000"

  player:
    build: ./player
    ports:
      - "4000:4000"

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: vod_database

  redis:
    image: redis:7-alpine
```

Run:
```bash
docker-compose up -d
```

### Manual Deployment

1. Install dependencies
2. Configure environment variables
3. Build applications
4. Start with PM2:
```bash
pm2 start panel/back/dist/main.js --name vod-backend
pm2 start panel/front/node_modules/next/dist/bin/next --name vod-frontend -- start
pm2 start player/src/server.js --name vod-player
```

## Troubleshooting

### Upload Failures
- Check TUS server configuration
- Verify disk space in uploads directory
- Check file permissions
- Increase server timeout for large files

### Processing Failures
- Verify FFmpeg is installed
- Check Redis connection
- Monitor Bull queue health
- Check S3 credentials and permissions

### Playback Issues
- Verify HLS files exist in S3
- Check CORS configuration on S3
- Test HLS URL directly in VLC
- Check player console for errors

## Security

- Implement authentication for admin panel
- Use HTTPS in production
- Secure S3 bucket with proper IAM policies
- Rate limit upload endpoints
- Validate all user inputs
- Sanitize file names
- Implement user quotas

## Performance Optimization

- Use CDN for HLS delivery
- Implement caching layer
- Optimize database queries
- Use Redis for session storage
- Scale workers for processing queue
- Enable S3 transfer acceleration

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Saken Tukenov

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [TUS Protocol](https://tus.io/) - Resumable file uploads
- [Bull](https://github.com/OptimalBits/bull) - Queue management
- [TypeORM](https://typeorm.io/) - Database ORM
- [NestJS](https://nestjs.com/) - Backend framework
- [Next.js](https://nextjs.org/) - Frontend framework
- [HLS.js](https://github.com/video-dev/hls.js/) - Video player
