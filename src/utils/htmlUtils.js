import { getTimestamp } from './timeUtils.js';

// Maximum length for Telegram messages
export const MAX_MESSAGE_LENGTH = 4000;

// Process Spotify links to ensure they are properly formatted
export function processSpotifyLinks(text) {
    const lines = text.split('\n');
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === 'Listen on Spotify') {
            let spotifyUrl = null;
            
            if (i + 1 < lines.length && lines[i + 1].includes('https://open.spotify.com/')) {
                spotifyUrl = lines[i + 1].trim();
                i++; // Skip the URL line
            } 
            else if (line.includes('https://open.spotify.com/')) {
                const urlMatch = line.match(/(https:\/\/open\.spotify\.com\/[^\s)]+)/);
                if (urlMatch) {
                    spotifyUrl = urlMatch[1];
                }
            }
            
            if (spotifyUrl) {
                spotifyUrl = spotifyUrl.replace(/[)]$/, '');
                processedLines.push(`<a href="${spotifyUrl}">Listen on Spotify</a>`);
            } else {
                processedLines.push(line);
            }
        }
        else if (line.includes('Listen on Spotify') && line.includes('https://open.spotify.com/')) {
            const urlMatch = line.match(/(https:\/\/open\.spotify\.com\/[^\s)]+)/);
            if (urlMatch) {
                const spotifyUrl = urlMatch[1].replace(/[)]$/, '');
                // Replace the entire line with a properly formatted link
                processedLines.push(`<a href="${spotifyUrl}">Listen on Spotify</a>`);
            } else {
                processedLines.push(line);
            }
        }
        else if (line.includes('[Listen on Spotify]') && line.includes('https://open.spotify.com/')) {
            const urlMatch = line.match(/\[Listen on Spotify\]\((https:\/\/open\.spotify\.com\/[^)]+)\)/);
            if (urlMatch) {
                processedLines.push(`<a href="${urlMatch[1]}">Listen on Spotify</a>`);
            } else {
                processedLines.push(line);
            }
        }
        else {
            processedLines.push(line);
        }
    }
    
    return processedLines.join('\n');
}

// Format the message as HTML
export function formatAsHtml(text) {
    if (!text) return "";
    
    if (!text.includes('<a href=')) {
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)\)/g, '[$1]($2)');
        
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    }
    
    if (!text.includes('<b>')) {
        text = text.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    }
    
    if (!text.includes('<i>')) {
        text = text.replace(/_([^_]+)_/g, '<i>$1</i>');
    }
    
    return text;
}

// Split message into chunks, preserving song groups
export function splitMessageBySong(message, maxLength = MAX_MESSAGE_LENGTH) {
    const chunks = [];
    const songs = message.split("\n\n");

    let currentChunk = "";

    for (const song of songs) {
        if ((currentChunk.length + song.length + 2) > maxLength) {
            chunks.push(currentChunk.trim()); 
            currentChunk = ""; 
        }

        currentChunk += song + "\n\n"; 
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// Format playlist metadata changes for notification
export function formatPlaylistChanges(oldMetadata, newMetadata, imageChanged = false) {
    let message = `*— _${oldMetadata.name}_ updated! —*\n\n`;

    if (oldMetadata.name !== newMetadata.name) {
        message += `*Name:*\n${oldMetadata.name} ➔ _${newMetadata.name}_\n\n`;
    }

    // Description change
    if (oldMetadata.description !== newMetadata.description) {
        message += `*Description:*\n`;
        message += oldMetadata.description ? `${oldMetadata.description}` : "(empty)";
        message += ` ➔ `;
        message += newMetadata.description ? `_${newMetadata.description}_` : "(empty)";
        message += `\n\n`;
    }

    // Image change - only include if we're confident it actually changed
    if (imageChanged) {
        message += `*Image:* Changed\n\n`;
    }

    message += `[Open Playlist](https://open.spotify.com/playlist/${newMetadata.id})`;

    return message;
}
