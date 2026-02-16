import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Database connection
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '../views'));

// Serve static files from dist/public
app.use('/dist', express.static(join(__dirname, '../dist/public')));

// Routes
app.get('/', (req, res) => {
  res.render('template', {
    VideoSrc: "https://storage.vod.31kz.adapto.kz/package/d1696e20-3828-421e-b188-aabb0342950d/hls/master.m3u8",
    VideoPoster: "path/to/poster.jpg"
  });
});

app.get('/embed/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT filename, title, description, s3_key, asset_id FROM videos WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).send('Not Found');
    }

    const video = rows[0];
    const videoSrc = video.asset_id
      ? `https://storage.vod.31kz.adapto.kz/package/${video.asset_id}/hls/master.m3u8`
      : video.s3_key
      ? `https://object.pscloud.io/adapto-31kz-vod/${video.s3_key}`
      : video.filename;

    res.render('template', {
      VideoSrc: videoSrc,
      VideoPoster: "path/to/poster.jpg",
      Title: video.title,
      Description: video.description
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Server Error');
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 