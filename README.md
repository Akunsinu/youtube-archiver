# YouTube Channel Archiver

A self-hosted Docker application for archiving YouTube channels, including videos, metadata, and comments. Features a web-based viewer for browsing and watching archived content.

## Features

- **Full Channel Archive**: Download videos (up to 1080p), thumbnails, metadata, and comments
- **Web Viewer**: YouTube-like interface for browsing and watching archived videos
- **Sync Options**:
  - Manual sync with time filters (past week, month, year, all)
  - Automatic daily sync at configurable time
  - Sync types: new only, full, metadata only, comments only
- **Real-time Status**: Live progress updates via WebSocket
- **Preserved Content**: Keeps videos even if deleted/private on YouTube

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Python FastAPI
- **Database**: PostgreSQL
- **Downloads**: yt-dlp
- **Metadata**: YouTube Data API v3

## Prerequisites

- Docker and Docker Compose
- YouTube Data API v3 key ([Get one here](https://console.cloud.google.com/apis/credentials))

## Quick Start

1. **Clone and configure**:
   ```bash
   cd youtube-archiver
   cp .env.example .env
   ```

2. **Edit `.env`** with your settings:
   ```env
   YOUTUBE_API_KEY=your_api_key_here
   VIDEO_STORAGE_PATH=/path/to/storage  # e.g., /mnt/user/appdata/youtube-archiver
   ```

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the web interface**:
   - Frontend: http://localhost:3080
   - Backend API: http://localhost:8081

5. **Configure your channel**:
   - Go to the Channel page
   - Enter your YouTube channel ID (UCxxxx) or @handle
   - Enter your YouTube API key
   - Click Configure

6. **Start syncing**:
   - Go to the Sync page
   - Choose sync type and time filter
   - Click Start Sync

## Unraid Installation

1. Create directories:
   ```
   /mnt/user/appdata/youtube-archiver/storage
   ```

2. Set environment variables in your container template:
   - `YOUTUBE_API_KEY`: Your API key
   - `VIDEO_STORAGE_PATH`: /mnt/user/appdata/youtube-archiver/storage

3. Map ports:
   - 3080 (frontend)
   - 8081 (backend)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | Required |
| `VIDEO_STORAGE_PATH` | Host path for video storage | `./storage` |
| `DATABASE_URL` | PostgreSQL connection string | Set by docker-compose |

### Sync Settings

Configure via the web interface:
- **Auto-sync**: Enable/disable daily sync
- **Sync time**: When to run auto-sync (default: 3:00 AM)
- **Max quality**: 1080p, 720p, or 480p
- **Sync comments**: Include/exclude comments

## API Endpoints

### Videos
- `GET /api/v1/videos` - List videos (paginated, searchable)
- `GET /api/v1/videos/{id}` - Get video details
- `GET /api/v1/videos/{id}/stream` - Stream video file
- `GET /api/v1/videos/{id}/thumbnail` - Get thumbnail

### Comments
- `GET /api/v1/comments/video/{id}` - Get video comments
- `GET /api/v1/comments/{id}/replies` - Get comment replies

### Channel
- `GET /api/v1/channel` - Get channel info
- `PUT /api/v1/channel/config` - Configure channel

### Sync
- `POST /api/v1/sync/start` - Start sync job
- `POST /api/v1/sync/stop` - Stop current sync
- `GET /api/v1/sync/status` - Get sync status
- `GET/PUT /api/v1/sync/config` - Sync configuration

### Status
- `GET /api/v1/status` - Overall status
- `GET /api/v1/status/queue` - Download queue
- `GET /api/v1/status/storage` - Storage info
- `WS /api/v1/ws` - WebSocket for real-time updates

## Storage Structure

```
storage/
├── videos/
│   └── {youtube_video_id}/
│       ├── video.mp4
│       └── thumbnail.jpg
└── channel/
    ├── banner.jpg
    └── avatar.jpg
```

## Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting

### Common Issues

1. **API quota exceeded**: YouTube API has daily quotas. Reduce sync frequency or wait 24 hours.

2. **Download failures**: yt-dlp may need updating. Rebuild the Docker container or update manually.

3. **Videos not playing**: Ensure videos are downloaded (green badge). Check browser console for errors.

4. **Database connection errors**: Ensure PostgreSQL container is running and healthy.

## License

MIT License
