// playlist-tracker.js - Main logic file
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { getSpotifyToken, getPlaylistTracks } from "./services/spotifyService.js";
import { sendTelegramMessage } from "./services/telegramService.js";
import { getTimestamp } from './utils/timeUtils.js';
import { escapeMarkdown } from "./utils/markdownUtils.js";
import { config } from "./config.js";

// Get the directory name using ES modules syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONGS_FILE = path.resolve(__dirname, "../data/songs.json");
const PLAYLISTS_FILE = path.resolve(__dirname, "../data/playlists.json");

// Format a single track for notification message
function formatTrackMessage(track, isNew = true) {
    // Track title and artist
    let message = `*${escapeMarkdown(track.name)}*\n`;
    message += `${escapeMarkdown(track.artist)}\n`;

    // Add date information
    if (track.added_at) {
        const formattedDate = getTimestamp(track.added_at);
        message += `_${escapeMarkdown(`${isNew ? "Added" : "Was added"} on ${formattedDate}`)}_\n`;
    }
    
    // Add track URL
    if (track.url) {
        message += `[Listen on Spotify](${escapeMarkdown(track.url)})`;
    }

    return message;
}

// Format header for notification messages
function formatMessageHeader(playlistName, count, isNew = true) {
    const symbol = isNew ? "☆" : "♡";
    const action = isNew ? "Added to" : "Removed from";
    return `${symbol} *${count} ${count === 1 ? "Song" : "Songs"} ${action} _${escapeMarkdown(playlistName)}_* ${symbol}\n`;
}

// Function to check for new and removed songs
async function checkForSongChanges() {
    const token = await getSpotifyToken(config.spotifyClientId, config.spotifyClientSecret);
    if (!token) return;

    let playlists;
    try {
        const data = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
        playlists = data.playlists || [];
    } catch (error) {
        console.error('Error reading playlists.json:', error);
        return;
    }

    let updated = false; // Track if we need to update playlists.json

    for (let i = 0; i < playlists.length; i++) {
        let playlist = playlists[i];

        // If playlist is stored as an ID string, convert it to an object
        if (typeof playlist === "string") {
            playlist = { id: playlist, name: null }; // Set name as null initially
        }

        // Fetch playlist name if missing or outdated
        if (!playlist.name) {
            const data = await getPlaylistTracks(playlist.id, token);
            if (!data) continue;
            
            playlist.name = data.playlistName; // Set the name
            updated = true;
            console.log(`Updated playlist: ${playlist.id} -> ${playlist.name}`);
        }

        // Update the array with the modified object
        playlists[i] = playlist;
    }

     // Save updates to playlists.json if any names were updated
    if (updated) {
        fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify({ playlists }, null, 2));
        console.log("Updated playlists.json with playlist names.");
    }

    if (!fs.existsSync(SONGS_FILE) || fs.readFileSync(SONGS_FILE, "utf-8").trim() === "") {
        fs.writeFileSync(SONGS_FILE, JSON.stringify({}, null, 2));
    }

    // Safely parse JSON file
    let storedSongs;

    try {
        storedSongs = JSON.parse(fs.readFileSync(SONGS_FILE, "utf-8"));
    } catch (error) {
        console.error("Error reading songs.json, resetting it.");
        storedSongs = {};
        fs.writeFileSync(SONGS_FILE, JSON.stringify(storedSongs, null, 2));
    }

    let changesMade = false; // Track if any changes were found

    for (const playlist of playlists) {
        const data = await getPlaylistTracks(playlist.id, token);
        if (!data) continue;

        const { playlistName, tracks } = data;

        // Update stored playlist name if missing or outdated
        if (!playlist.name || playlist.name !== playlistName) {
            playlist.name = playlistName;
            updated = true;
        }

        const trackIds = tracks.map((track) => track.id);

        // Ensure playlist exists in storedSongs with the proper structure
        if (!storedSongs[playlist.id] || typeof storedSongs[playlist.id] !== 'object') {
            storedSongs[playlist.id] = { ids: [], trackDetails: {} };
        }

        if (!storedSongs[playlist.id].trackDetails) {
            storedSongs[playlist.id].trackDetails = {};
        }
        

        // Find removed songs BEFORE updating stored details
        const removedTrackIds = storedSongs[playlist.id].ids.filter(
            (songId) => !trackIds.includes(songId),
        );

        const removedTracks = removedTrackIds.map((songId) => ({
            id: songId,
            ...(storedSongs[playlist.id].trackDetails[songId] || {})
        }));

        // Process removed songs
        if (removedTracks.length > 0) {
            removedTracks.forEach(track => {
                console.log(`Removed: ${track.name || 'Unknown'} (ID: ${track.id})`);
                delete storedSongs[playlist.id].trackDetails[track.id];
            });

            // Send Telegram notification
            const header = formatMessageHeader(playlistName, removedTracks.length, false);
            const tracksFormatted = removedTracks.map(track => formatTrackMessage(track, false)).join("\n\n");

            await sendTelegramMessage(`${header}\n${tracksFormatted}`, config.telegramBotToken, config.telegramChatId);
        }

        // Clean up trackDetails
        const cleanedTrackDetails = {};
        for (const trackId of trackIds) {
            if (storedSongs[playlist.id].trackDetails[trackId]) {
                cleanedTrackDetails[trackId] = storedSongs[playlist.id].trackDetails[trackId];
            }
        }

        // Store all current track details for future reference
        tracks.forEach((track) => {
            cleanedTrackDetails[track.id] = {
                name: track.name,
                artist: track.artist,
                added_at: track.added_at,
                url: track.url
            };
        });

        // Replace the entire trackDetails object with our cleaned version
        storedSongs[playlist.id].trackDetails = cleanedTrackDetails;

        // Find new songs
        const newTracks = tracks.filter(
            (track) => !storedSongs[playlist.id].ids.includes(track.id),
        );

        if (newTracks.length > 0) {
            // Log added songs
            changesMade = true;
            newTracks.forEach((track) => {
                console.log(`Added: ${track.name} (ID: ${track.id})`);
            });

            const header = formatMessageHeader(
                playlistName,
                newTracks.length,
                true,
            );
            const tracksFormatted = newTracks
                .map((track) => formatTrackMessage(track, true))
                .join("\n\n");

            const message = `${header}\n${tracksFormatted}`;
            await sendTelegramMessage(message, config.telegramBotToken, config.telegramChatId);
        }

        // Update stored tracks with current playlist state
        storedSongs[playlist.id].ids = trackIds;
    }

    // After processing all playlists, check if any changes were made
    if (!changesMade) {
        const message = `No changes detected\n_${escapeMarkdown(getTimestamp())}_`;
        await sendTelegramMessage(message, config.telegramBotToken, config.telegramChatId);
        console.log(`[${escapeMarkdown(getTimestamp())}] No changes detected, bot sent status message.`);
    }
    
    // Save updated data
    fs.writeFileSync(SONGS_FILE, JSON.stringify(storedSongs, null, 2));
    console.log("Finished checking for song changes");
    return { success: true };
}

// Main function to be called from GitHub Actions
export async function runPlaylistTracker() {    
    // Validate configuration
    const missingEnvVars = Object.keys(config).filter((key) => !config[key]);
    
    if (missingEnvVars.length > 0) {
        console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        process.exit(1);
    }
    
    return await checkForSongChanges(config);
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPlaylistTracker()
        .then(() => console.log("Playlist checking completed"))
        .catch(err => console.error("Error running playlist tracker:", err));
}// playlist-tracker.js - Main logic file
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { getSpotifyToken, getPlaylistTracks } from "./services/spotifyService.js";
import { sendTelegramMessage } from "./services/telegramService.js";
import { getTimestamp } from './utils/timeUtils.js';
import { escapeMarkdown } from "./utils/markdownUtils.js";
import { config } from "./config.js";

// Get the directory name using ES modules syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONGS_FILE = path.resolve(__dirname, "../data/songs.json");
const PLAYLISTS_FILE = path.resolve(__dirname, "../data/playlists.json");

// Format a single track for notification message
function formatTrackMessage(track, isNew = true) {
    // Track title and artist
    let message = `*${escapeMarkdown(track.name)}*\n`;
    message += `${escapeMarkdown(track.artist)}\n`;

    // Add date information
    if (track.added_at) {
        const formattedDate = getTimestamp(track.added_at);
        message += `_${escapeMarkdown(`${isNew ? "Added" : "Was added"} on ${formattedDate}`)}_\n`;
    }
    
    // Add track URL
    if (track.url) {
        message += `[Listen on Spotify](${escapeMarkdown(track.url)})`;
    }

    return message;
}

// Format header for notification messages
function formatMessageHeader(playlistName, count, isNew = true) {
    const symbol = isNew ? "☆" : "♡";
    const action = isNew ? "Added to" : "Removed from";
    return `${symbol} *${count} ${count === 1 ? "Song" : "Songs"} ${action} _${escapeMarkdown(playlistName)}_* ${symbol}\n`;
}

// Function to check for new and removed songs
async function checkForSongChanges() {
    const token = await getSpotifyToken(config.spotifyClientId, config.spotifyClientSecret);
    if (!token) return;

    let playlists;
    try {
        const data = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
        playlists = data.playlists || [];
    } catch (error) {
        console.error('Error reading playlists.json:', error);
        return;
    }

    let updated = false; // Track if we need to update playlists.json

    for (let i = 0; i < playlists.length; i++) {
        let playlist = playlists[i];

        // If playlist is stored as an ID string, convert it to an object
        if (typeof playlist === "string") {
            playlist = { id: playlist, name: null }; // Set name as null initially
        }

        // Fetch playlist name if missing or outdated
        if (!playlist.name) {
            const data = await getPlaylistTracks(playlist.id, token);
            if (!data) continue;
            
            playlist.name = data.playlistName; // Set the name
            updated = true;
            console.log(`Updated playlist: ${playlist.id} -> ${playlist.name}`);
        }

        // Update the array with the modified object
        playlists[i] = playlist;
    }

     // Save updates to playlists.json if any names were updated
    if (updated) {
        fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify({ playlists }, null, 2));
        console.log("Updated playlists.json with playlist names.");
    }

    if (!fs.existsSync(SONGS_FILE) || fs.readFileSync(SONGS_FILE, "utf-8").trim() === "") {
        fs.writeFileSync(SONGS_FILE, JSON.stringify({}, null, 2));
    }

    // Safely parse JSON file
    let storedSongs;

    try {
        storedSongs = JSON.parse(fs.readFileSync(SONGS_FILE, "utf-8"));
    } catch (error) {
        console.error("Error reading songs.json, resetting it.");
        storedSongs = {};
        fs.writeFileSync(SONGS_FILE, JSON.stringify(storedSongs, null, 2));
    }

    let changesMade = false; // Track if any changes were found

    for (const playlist of playlists) {
        const data = await getPlaylistTracks(playlist.id, token);
        if (!data) continue;

        const { playlistName, tracks } = data;

        // Update stored playlist name if missing or outdated
        if (!playlist.name || playlist.name !== playlistName) {
            playlist.name = playlistName;
            updated = true;
        }

        const trackIds = tracks.map((track) => track.id);

        // Ensure playlist exists in storedSongs with the proper structure
        if (!storedSongs[playlist.id] || typeof storedSongs[playlist.id] !== 'object') {
            storedSongs[playlist.id] = { ids: [], trackDetails: {} };
        }

        if (!storedSongs[playlist.id].trackDetails) {
            storedSongs[playlist.id].trackDetails = {};
        }
        

        // Find removed songs BEFORE updating stored details
        const removedTrackIds = storedSongs[playlist.id].ids.filter(
            (songId) => !trackIds.includes(songId),
        );

        const removedTracks = removedTrackIds.map((songId) => ({
            id: songId,
            ...(storedSongs[playlist.id].trackDetails[songId] || {})
        }));

        // Process removed songs
        if (removedTracks.length > 0) {
            removedTracks.forEach(track => {
                console.log(`Removed: ${track.name || 'Unknown'} (ID: ${track.id})`);
                delete storedSongs[playlist.id].trackDetails[track.id];
            });

            // Send Telegram notification
            const header = formatMessageHeader(playlistName, removedTracks.length, false);
            const tracksFormatted = removedTracks.map(track => formatTrackMessage(track, false)).join("\n\n");

            await sendTelegramMessage(`${header}\n${tracksFormatted}`, config.telegramBotToken, config.telegramChatId);
        }

        // Clean up trackDetails
        const cleanedTrackDetails = {};
        for (const trackId of trackIds) {
            if (storedSongs[playlist.id].trackDetails[trackId]) {
                cleanedTrackDetails[trackId] = storedSongs[playlist.id].trackDetails[trackId];
            }
        }

        // Store all current track details for future reference
        tracks.forEach((track) => {
            cleanedTrackDetails[track.id] = {
                name: track.name,
                artist: track.artist,
                added_at: track.added_at,
                url: track.url
            };
        });

        // Replace the entire trackDetails object with our cleaned version
        storedSongs[playlist.id].trackDetails = cleanedTrackDetails;

        // Find new songs
        const newTracks = tracks.filter(
            (track) => !storedSongs[playlist.id].ids.includes(track.id),
        );

        if (newTracks.length > 0) {
            // Log added songs
            changesMade = true;
            newTracks.forEach((track) => {
                console.log(`Added: ${track.name} (ID: ${track.id})`);
            });

            const header = formatMessageHeader(
                playlistName,
                newTracks.length,
                true,
            );
            const tracksFormatted = newTracks
                .map((track) => formatTrackMessage(track, true))
                .join("\n\n");

            const message = `${header}\n${tracksFormatted}`;
            await sendTelegramMessage(message, config.telegramBotToken, config.telegramChatId);
        }

        // Update stored tracks with current playlist state
        storedSongs[playlist.id].ids = trackIds;
    }

    // After processing all playlists, check if any changes were made
    if (!changesMade) {
        const message = `No changes detected\n_${escapeMarkdown(getTimestamp())}_`;
        await sendTelegramMessage(message, config.telegramBotToken, config.telegramChatId);
        console.log(`[${escapeMarkdown(getTimestamp())}] No changes detected, bot sent status message.`);
    }
    
    // Save updated data
    fs.writeFileSync(SONGS_FILE, JSON.stringify(storedSongs, null, 2));
    console.log("Finished checking for song changes");
    return { success: true };
}

// Main function to be called from GitHub Actions
export async function runPlaylistTracker() {    
    // Validate configuration
    const missingEnvVars = Object.keys(config).filter((key) => !config[key]);
    
    if (missingEnvVars.length > 0) {
        console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        process.exit(1);
    }
    
    return await checkForSongChanges(config);
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPlaylistTracker()
        .then(() => console.log("Playlist checking completed"))
        .catch(err => console.error("Error running playlist tracker:", err));
}
