// server.js - Simple web server with webhook endpoint
import express from 'express';
import { runPlaylistTracker } from './src/playlist-tracker.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Simple endpoint for health checks
app.get('/', (req, res) => {
  res.send('Spotify Playlist Tracker API is running');
});

// Webhook to trigger playlist check
app.get('/check-playlists', async (req, res) => {
  // Simple authentication using a secret token
  const token = req.query.token;
  if (token !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const result = await runPlaylistTracker();
    res.json({ success: true, message: 'Playlist check triggered successfully', ...result });
  } catch (error) {
    console.error('Error checking playlists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});