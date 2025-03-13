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
    console.log(`[${getTimestamp()}] Received /setplaylist command with ID: ${newPlaylistId}`);

    if (!newPlaylistId) {
        return ctx.reply('⚠️ Please provide a playlist ID. Example: /setplaylist <playlist_id>');
    }

    const playlists = loadPlaylists();
    if (playlists.includes(newPlaylistId)) {
        return ctx.reply(`ℹ️ Playlist ${newPlaylistId} is already in the list.`);
    }

    playlists.push(newPlaylistId);
    savePlaylists(playlists);
    ctx.reply(`✅ Playlist ${newPlaylistId} added successfully.`);
});

// Command: Remove a playlist
bot.command('delete', (ctx) => {
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return ctx.reply('❌ Unauthorized.');
    }
    
    const playlistIdToRemove = ctx.message.text.split(' ')[1]?.trim();
    console.log(`[${getTimestamp()}] Received /removeplaylist command with ID: ${playlistIdToRemove}`);

    if (!playlistIdToRemove) {
        return ctx.reply('⚠️ Please provide a playlist ID. Example: /removeplaylist <playlist_id>');
    }

    const playlists = loadPlaylists();
    const index = playlists.indexOf(playlistIdToRemove);
    if (index === -1) {
        return ctx.reply(`ℹ️ Playlist ${playlistIdToRemove} is not in the list.`);
    }

    playlists.splice(index, 1);
    savePlaylists(playlists);
    ctx.reply(`✅ Playlist ${playlistIdToRemove} removed successfully.`);
});

// list playlists
bot.command('list', (ctx) => {
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return ctx.reply('❌ Unauthorized.');
    }

    const playlists = loadPlaylists();
    if (!playlists || playlists.length === 0) {
        return ctx.reply('ℹ️ No playlists are currently being tracked.');
    }

    // Escape playlist names and IDs properly
    const formattedList = playlists
        .map((playlist) => `\\-\\ *${escapeMarkdown(playlist.name || "Unknown Playlist")}*\n  \`${escapeMarkdown(playlist.id)}\``)
        .join("\n\n");

    const message = `📌 *Tracked Playlists:*\n\n${formattedList}`;

    ctx.reply(message, { parse_mode: "MarkdownV2" });
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
