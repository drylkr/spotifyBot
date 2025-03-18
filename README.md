# Spotify Playlist Tracker  

A bot that tracks changes in Spotify playlists and sends updates via Telegram.  

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
5. Run automatically with GitHub Actions

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

![image](https://github.com/user-attachments/assets/f4392a6d-92b6-4879-b794-293882a5fda4)

![image](https://github.com/user-attachments/assets/f1f4896c-8269-4310-acf3-a9c930723c1e)

![image](https://github.com/user-attachments/assets/65b95fb5-e3a4-4b5f-ba29-20c2b1506d6c)

![image](https://github.com/user-attachments/assets/ca7b81be-cf74-42bc-a83c-f431f2e200fe)

![image](https://github.com/user-attachments/assets/a949e0e9-9895-4419-a0e0-25211be5377f)




