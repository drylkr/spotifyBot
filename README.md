# Spotify Playlist Tracker  

A bot that tracks Spotify playlist changes, sending updates via Telegram.


## Features  
- Detects song additions/removals in playlists
- Detects name, description, and image updates in playlists
- Sends Telegram notifications  
- Runs automatically with GitHub Actions  

## Setup  
1. Clone the repo  
2. Add secrets in GitHub:  
   - `SPOTIFY_CLIENT_ID`  
   - `SPOTIFY_CLIENT_SECRET`  
   - `TELEGRAM_BOT_TOKEN`  
   - `TELEGRAM_CHAT_ID`
4. Add playlists to track in data/playlists.json (ID & name)
6. Run automatically with GitHub Actions

## Playlist JSON Format
- Add playlists in data/playlists.json:
  
`[
  { "id": "37i9dQZF1DXcBWIGoYBM5M", "name": "Today's Top Hits" },
  { "id": "37i9dQZF1DX0XUsuxWHRQd", "name": "RapCaviar" }
]`

## Telegram Bot Commands (⚠️ Not Fully Supported)
- The following commands only work if you run the bot manually (node src/telegram-bot.js):

`/check` – Manually check for updates  
`/list` – Show tracked playlists  
`/info` – Show playlist information 
`/set [playlist_id]` – Add a playlist to track  
`/delete [playlist_id]` – Remove a tracked playlist

## Automation  
- Runs every 12 minutes via GitHub Actions  

---
💡 **Made for tracking playlist updates effortlessly!** 


<img width="1831" height="930" alt="spotify-1" src="https://github.com/user-attachments/assets/053ee967-8556-413b-b8a0-531e116f32c8" />
<img width="1832" height="990" alt="spotify-2" src="https://github.com/user-attachments/assets/f8fb25f8-365f-447f-9624-879b22bb22be" />
<img width="1834" height="863" alt="spotify-4" src="https://github.com/user-attachments/assets/1cfaeabc-e570-4e44-b92b-dfe80ad1a5c8" />
<img width="1828" height="927" alt="spotify-3" src="https://github.com/user-attachments/assets/304874c2-f961-4027-8725-af806919b240" />
<img width="1829" height="934" alt="spotify-5" src="https://github.com/user-attachments/assets/e6f6668b-11d7-477b-a25c-d9d92b43b495" />




