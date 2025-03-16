import { Telegraf } from 'telegraf';
import { runPlaylistTracker } from './playlist-tracker.js';
import { getTimestamp } from './utils/timeUtils.js'; 
import { fileURLToPath } from 'url';
import { escapeMarkdown } from "./utils/markdownUtils.js";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// Initialize the bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Get the directory name using ES modules syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the path to playlists.json
const PLAYLISTS_FILE = path.resolve(__dirname, "../data/playlists.json");
const METADATA_FILE = path.resolve(__dirname, "../data/metadata.json");

// Load playlists from file safely
function loadPlaylists() {
    console.log(`[${getTimestamp()}] Loading playlists from: ${PLAYLISTS_FILE}`);

    if (!fs.existsSync(PLAYLISTS_FILE)) {
        console.warn(`[${getTimestamp()}] ⚠️ playlists.json not found, creating default file.`);
        savePlaylists([]); // Create an empty file
        return [];
    }

    try {
        const playlistsData = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
        return playlistsData.playlists || [];
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ Error reading playlists.json:`, error);
        savePlaylists([]); // Reset file if there's a parsing error
        return [];
    }
}

// Save playlists to file
function savePlaylists(playlists) {
    console.log(`[${getTimestamp()}] Saving playlists to: ${PLAYLISTS_FILE}`);
    try {
        fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify({ playlists }, null, 2));
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ Error saving playlists.json:`, error);
    }
}

// Load metadata from file safely
function loadMetadata() {
    console.log(`[${getTimestamp()}] Loading metadata from: ${METADATA_FILE}`);

    if (!fs.existsSync(METADATA_FILE)) {
        console.warn(`[${getTimestamp()}] ⚠️ metadata.json not found, creating default file.`);
        saveMetadata({}); // Create an empty file
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ Error reading metadata.json:`, error);
        saveMetadata({}); // Reset file if there's a parsing error
        return {};
    }
}

// Save metadata to file
function saveMetadata(metadata) {
    console.log(`[${getTimestamp()}] Saving metadata to: ${METADATA_FILE}`);
    try {
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ Error saving metadata.json:`, error);
    }
}

// Command: Check for playlist changes
bot.command('check', async (ctx) => {
    try {
        if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
            return ctx.reply('❌ Unauthorized.');
        }

        await ctx.reply('🔍 Checking for playlist changes...');
        const result = await runPlaylistTracker();

        if (result?.success) {
            await ctx.reply('✅ Playlist check completed successfully.');
        } else {
            await ctx.reply('⚠️ Error checking playlists.');
        }
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ Error in /check command:`, error);
        await ctx.reply(`❌ Error: ${error.message}`);
    }
});

// Command: Add a playlist
bot.command('set', (ctx) => {
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return ctx.reply('❌ Unauthorized.');
    }
    
    const newPlaylistId = ctx.message.text.split(' ')[1]?.trim();
    console.log(`[${getTimestamp()}] Received /set command with ID: ${newPlaylistId}`);

    if (!newPlaylistId) {
        return ctx.reply('⚠️ Please provide a playlist ID. Example: /set <playlist_id>');
    }

    const playlists = loadPlaylists();
    
    // Check if playlist already exists
    const existingPlaylist = playlists.find(playlist => 
        (typeof playlist === 'string' && playlist === newPlaylistId) || 
        (typeof playlist === 'object' && playlist.id === newPlaylistId)
    );
    
    if (existingPlaylist) {
        return ctx.reply(`ℹ️ Playlist ${newPlaylistId} is already in the list.`);
    }

    // Add new playlist as an object with id
    playlists.push({ id: newPlaylistId, name: null });
    savePlaylists(playlists);
    ctx.reply(`✅ Playlist ${newPlaylistId} added successfully.`);
});

// Command: Remove a playlist
bot.command('delete', (ctx) => {
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return ctx.reply('❌ Unauthorized.');
    }
    
    const playlistIdToRemove = ctx.message.text.split(' ')[1]?.trim();
    console.log(`[${getTimestamp()}] Received /delete command with ID: ${playlistIdToRemove}`);

    if (!playlistIdToRemove) {
        return ctx.reply('⚠️ Please provide a playlist ID. Example: /delete <playlist_id>');
    }

    const playlists = loadPlaylists();
    
    // Find playlist index regardless of whether it's a string or object
    const index = playlists.findIndex(playlist => 
        (typeof playlist === 'string' && playlist === playlistIdToRemove) || 
        (typeof playlist === 'object' && playlist.id === playlistIdToRemove)
    );
    
    if (index === -1) {
        return ctx.reply(`ℹ️ Playlist ${playlistIdToRemove} is not in the list.`);
    }

    // Remove playlist
    playlists.splice(index, 1);
    savePlaylists(playlists);
    
    // Also remove from metadata if it exists
    const metadata = loadMetadata();
    if (metadata[playlistIdToRemove]) {
        delete metadata[playlistIdToRemove];
        saveMetadata(metadata);
    }
    
    ctx.reply(`✅ Playlist ${playlistIdToRemove} removed successfully.`);
});

// List playlists with metadata
bot.command('list', (ctx) => {
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return ctx.reply('❌ Unauthorized.');
    }

    const playlists = loadPlaylists();
    if (!playlists || playlists.length === 0) {
        return ctx.reply('ℹ️ No playlists are currently being tracked.');
    }

    const metadata = loadMetadata();

    // Format playlist list with enhanced metadata
    const formattedList = playlists.map(playlist => {
        // Get ID regardless of playlist format
        const id = typeof playlist === 'string' ? playlist : playlist.id;
        
        // Get name from playlist object or metadata
        let name = "Unknown Playlist";
        if (typeof playlist === 'object' && playlist.name) {
            name = playlist.name;
        } else if (metadata[id] && metadata[id].name) {
            name = metadata[id].name;
        }
        
        // Get followers if available
        let followersText = "";
        if (metadata[id] && metadata[id].followers) {
            followersText = `\\(${escapeMarkdown(metadata[id].followers.toString())} followers\\)`;
        }
        
        return `\\-\\ *${escapeMarkdown(name)}* ${followersText}\n  \`${escapeMarkdown(id)}\``;
    }).join("\n\n");

    const message = `📌 *Tracked Playlists:*\n\n${formattedList}`;

    ctx.reply(message, { parse_mode: "MarkdownV2" });
});

// Command: View playlist metadata
bot.command('info', (ctx) => {
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return ctx.reply('❌ Unauthorized.');
    }
    
    const playlistId = ctx.message.text.split(' ')[1]?.trim();
    
    if (!playlistId) {
        return ctx.reply('⚠️ Please provide a playlist ID. Example: /info <playlist_id>');
    }
    
    const metadata = loadMetadata();
    
    if (!metadata[playlistId]) {
        return ctx.reply(`ℹ️ No metadata found for playlist ${playlistId}.`);
    }
    
    const playlist = metadata[playlistId];
    
    // Format metadata as a nice message
    let message = `*Playlist Information*\n\n`;
    message += `*Name:* ${escapeMarkdown(playlist.name || "Unknown")}\n`;
    message += `*Description:* ${escapeMarkdown(playlist.description || "None")}\n`;
    message += `*Followers:* ${escapeMarkdown(playlist.followers?.toString() || "0")}\n`;
    message += `*Public:* ${playlist.public ? "Yes" : "No"}\n`;
    message += `*Owner:* ${escapeMarkdown(playlist.owner?.name || "Unknown")}\n`;
    message += `*Last checked:* ${escapeMarkdown(new Date(playlist.last_checked).toLocaleString())}\n\n`;
    message += `[Open on Spotify](https://open.spotify.com/playlist/${escapeMarkdown(playlistId)})`;
    
    // Send the message with the image if available
    if (playlist.image) {
        ctx.replyWithPhoto(
            { url: playlist.image },
            { 
                caption: message,
                parse_mode: "MarkdownV2"
            }
        ).catch(err => {
            console.error(`[${getTimestamp()}] ❌ Error sending photo:`, err);
            ctx.reply(message, { parse_mode: "MarkdownV2" });
        });
    } else {
        ctx.reply(message, { parse_mode: "MarkdownV2" });
    }
});

// Start the bot
bot.launch();
console.log(`[${getTimestamp()}] 🚀 Telegram bot started.`);

// Graceful shutdown handling
process.once('SIGINT', () => {
    console.log(`[${getTimestamp()}] 🛑 Stopping bot (SIGINT)...`);
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log(`[${getTimestamp()}] 🛑 Stopping bot (SIGTERM)...`);
    bot.stop('SIGTERM');
});
