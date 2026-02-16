const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');









dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('template', {
    VideoSrc: "https://storage.vod.31kz.adapto.kz/package/d1696e20-3828-421e-b188-aabb0342950d/hls/master.m3u8",
    VideoPoster: "path/to/poster.jpg"
  });
});

app.get('/embed/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT filename, title, description, s3_key, asset_id FROM videos WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).send('Server Error');
    if (results.length === 0) return res.status(404).send('Not Found');

    const video = results[0];
    const videoSrc = video.asset_id ?
      `https://storage.vod.31kz.adapto.kz/package/${video.asset_id}/hls/master.m3u8` :
      video.s3_key ? `https://object.pscloud.io/adapto-31kz-vod/${video.s3_key}` : video.filename;

    res.render('template', {
      VideoSrc: videoSrc,
      VideoPoster: "path/to/poster.jpg",
      Title: video.title,
      Description: video.description
    });
  });
});

app.get('/dist/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'release', 'dist', 'script.js'), {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 