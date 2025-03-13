# Spotify Playlist Tracker  

A bot that tracks changes in Spotify playlists and sends updates via Telegram.  

## Features  
- Detects song additions/removals in playlists  
- Sends Telegram notifications  
- Runs automatically with GitHub Actions  

## Setup  
1. Clone the repo  
2. Install dependencies: `npm install`  
3. Add secrets in GitHub:  
   - `SPOTIFY_CLIENT_ID`  
   - `SPOTIFY_CLIENT_SECRET`  
   - `TELEGRAM_BOT_TOKEN`  
   - `TELEGRAM_CHAT_ID`
4. Add playlists to track in data/playlists.json (ID & name)
5. Run automatically with GitHub Actions
6. Optional: Run Locally `node src/playlistTracker.js`

## Playlist JSON Format
- Add playlists in data/playlists.json like this:
`[
  { "id": "37i9dQZF1DXcBWIGoYBM5M", "name": "Today's Top Hits" },
  { "id": "37i9dQZF1DX0XUsuxWHRQd", "name": "RapCaviar" }
]`

## Telegram Bot Commands (⚠️ Not Fully Supported)
- The following commands only work if you run the bot manually (node src/telegram-bot.js) since GitHub Actions does not support real-time commands:

`/check` – Manually check for updates  
`/list` – Show tracked playlists  
`/set [playlist_id]` – Add a playlist to track  
`/delete [playlist_id]` – Remove a tracked playlist

## Automation  
- Runs every 15 minutes via GitHub Actions  

---
💡 **Made for tracking playlist updates effortlessly!**  

![image](https://github.com/user-attachments/assets/e50974ff-990b-4388-98fc-99aa6327d126)
