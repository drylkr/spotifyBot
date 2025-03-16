// playlist-tracker.js - Main logic file
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { getSpotifyToken, getPlaylistDetails } from "./services/spotifyService.js";
import { sendTelegramMessage, sendTelegramPhoto } from "./services/telegramService.js";
import { getTimestamp } from './utils/timeUtils.js';
import { formatPlaylistChanges } from './utils/htmlUtils.js';
import { config } from "./config.js";

// Get the directory name using ES modules syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONGS_FILE = path.resolve(__dirname, "../data/songs.json");
const PLAYLISTS_FILE = path.resolve(__dirname, "../data/playlists.json");
const METADATA_FILE = path.resolve(__dirname, "../data/metadata.json");

// Format a single track for notification message
function formatTrackMessage(track, isNew = true) {
    // Track title and artist
    let message = `*${(track.name)}*\n`;
    message += `${(track.artist)}\n`;

    // Add date information
    if (track.added_at) {
        const formattedDate = getTimestamp(track.added_at);
        message += `_${(`${isNew ? "Added" : "Was added"} on ${formattedDate}`)}_\n`;
    }
    
    // Add track URL
    if (track.url) {
        message += `[Listen on Spotify](${(track.url)})`;
    }

    return message;
}

// Format header for notification messages
function formatMessageHeader(playlistName, count, isNew = true) {
    const symbol = isNew ? "☆" : "♡";
    const action = isNew ? "Added to" : "Removed from";
    return `${symbol} *${count} ${count === 1 ? "Song" : "Songs"} ${action} _${(playlistName)}_* ${symbol}\n`;
}

// Ensure a file exists with default content
function ensureFileExists(filePath, defaultContent) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf-8").trim() === "") {
        fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// Function to check for playlist metadata changes
async function checkForMetadataChanges(playlistId, newMetadata, token) {
    ensureFileExists(METADATA_FILE, {});
    let metadata;
    
    try {
        metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
    } catch (error) {
        console.error("Error reading metadata.json, creating new file");
        metadata = {};
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    }

    // If we don't have stored metadata for this playlist, store it and return
    if (!metadata[playlistId]) {
        metadata[playlistId] = newMetadata;
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
        console.log(`Initial metadata stored for playlist: ${newMetadata.name}`);
        return false;
    }

    const oldMetadata = metadata[playlistId];
    let changed = false;

    // Log for debugging
    console.log("Old metadata image:", oldMetadata.image);
    console.log("New metadata image:", newMetadata.image);

    // Track when image was last checked without modifying URLs
    newMetadata.imageLastChecked = Date.now();

    // Strip any cache-busting parameters from URLs before comparing
    const stripParams = (url) => url ? url.split('?')[0] : url;
    const oldImageBase = stripParams(oldMetadata.image);
    const newImageBase = stripParams(newMetadata.image);

    // Check for metadata changes (using base URLs for images)
    if (
        oldMetadata.name !== newMetadata.name ||
        oldMetadata.description !== newMetadata.description ||
        oldImageBase !== newImageBase
    ) {
        changed = true;
        console.log(`Detected metadata changes for playlist: ${newMetadata.name}`);
        
        // Create change notification
        const message = formatPlaylistChanges(oldMetadata, newMetadata);
        
        // Send notification about changes
        await sendTelegramMessage(message, config.telegramBotToken, config.telegramChatId);
        
        // If image changed and we have a new image, send it separately
        if (oldImageBase !== newImageBase && newMetadata.image) {
            const caption = `New cover image for playlist: *${newMetadata.name}*`;
            // Send the actual image URL without cache-busting parameters for Telegram
            await sendTelegramPhoto(
                newImageBase, 
                caption, 
                config.telegramBotToken, 
                config.telegramChatId
            );
        }
    }

    // Update stored metadata - make sure this is a complete replacement
    // Store original URLs without cache-busting parameters
    metadata[playlistId] = { 
        ...newMetadata,
        // Store clean image URL
        image: stripParams(newMetadata.image)
    };
    
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    
    return changed;
}

// Function to check for new and removed songs
async function checkForSongChanges() {
    const token = await getSpotifyToken(config.spotifyClientId, config.spotifyClientSecret);
    if (!token) return;

    // Ensure playlist file exists with proper structure
    let playlistsData = ensureFileExists(PLAYLISTS_FILE, { playlists: [] });
    let playlists = playlistsData.playlists || [];

    let updated = false; // Track if we need to update playlists.json

    for (let i = 0; i < playlists.length; i++) {
        let playlist = playlists[i];

        // If playlist is stored as an ID string, convert it to an object
        if (typeof playlist === "string") {
            playlist = { id: playlist, name: null }; // Set name as null initially
        }

        // Fetch complete playlist details including metadata
        const data = await getPlaylistDetails(playlist.id, token);
        if (!data) continue;
        
        const { metadata, tracks } = data;
        
        // Check for metadata changes and send notifications if needed
        await checkForMetadataChanges(playlist.id, metadata, token);
        
        // Update stored playlist name if missing or outdated
        if (!playlist.name || playlist.name !== metadata.name) {
            playlist.name = metadata.name;
            updated = true;
            console.log(`Updated playlist: ${playlist.id} -> ${playlist.name}`);
        }

        // Update the array with the modified object
        playlists[i] = playlist;
        
        // Ensure songs file exists
        let storedSongs = ensureFileExists(SONGS_FILE, {});

        // Ensure playlist exists in storedSongs with the proper structure
        if (!storedSongs[playlist.id] || typeof storedSongs[playlist.id] !== 'object') {
            storedSongs[playlist.id] = { ids: [], trackDetails: {} };
        }

        if (!storedSongs[playlist.id].trackDetails) {
            storedSongs[playlist.id].trackDetails = {};
        }
        
        const trackIds = tracks.map((track) => track.id);

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
            const header = formatMessageHeader(metadata.name, removedTracks.length, false);
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
            newTracks.forEach((track) => {
                console.log(`Added: ${track.name} (ID: ${track.id})`);
            });

            const header = formatMessageHeader(
                metadata.name,
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
        
        // Save updated tracks data
        fs.writeFileSync(SONGS_FILE, JSON.stringify(storedSongs, null, 2));
    }
    
    // Save updates to playlists.json if any names were updated
    if (updated) {
        fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify({ playlists }, null, 2));
        console.log("Updated playlists.json with playlist names.");
    }
    
    console.log("Finished checking for song and metadata changes");
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
    
    return await checkForSongChanges();
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPlaylistTracker()
        .then(() => console.log("Playlist checking completed"))
        .catch(err => console.error("Error running playlist tracker:", err));
}
