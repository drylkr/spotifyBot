import { getTimestamp } from './timeUtils.js';

// Maximum length for Telegram messages
export const MAX_MESSAGE_LENGTH = 4000;

// Process Spotify links to ensure they are properly formatted
export function processSpotifyLinks(text) {
    // Split the text into lines to process line by line
    const lines = text.split('\n');
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this is a Spotify link line
        if (line.trim() === 'Listen on Spotify') {
            // Look for a URL in adjacent lines or in this line
            let spotifyUrl = null;
            
            // Check the next line
            if (i + 1 < lines.length && lines[i + 1].includes('https://open.spotify.com/')) {
                spotifyUrl = lines[i + 1].trim();
                i++; // Skip the URL line
            } 
            // Check if URL is in the same line but not formatted
            else if (line.includes('https://open.spotify.com/')) {
                const urlMatch = line.match(/(https:\/\/open\.spotify\.com\/[^\s)]+)/);
                if (urlMatch) {
                    spotifyUrl = urlMatch[1];
                }
            }
            
            if (spotifyUrl) {
                // Clean the URL - remove any trailing punctuation or parentheses
                spotifyUrl = spotifyUrl.replace(/[)]$/, '');
                processedLines.push(`<a href="${spotifyUrl}">Listen on Spotify</a>`);
            } else {
                processedLines.push(line);
            }
        }
        // Check if this line contains both "Listen on Spotify" and a URL
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
        // Check if this line contains a Markdown-formatted Spotify link
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
    
    // If already contains HTML links, don't process links again
    if (!text.includes('<a href=')) {
        // Fix broken markdown links with doubled parentheses
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)\)/g, '[$1]($2)');
        
        // Replace Markdown links with HTML links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    }
    
    // Replace Markdown bold with HTML bold (if not already HTML)
    if (!text.includes('<b>')) {
        text = text.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    }
    
    // Replace Markdown italic with HTML italic (if not already HTML)
    if (!text.includes('<i>')) {
        text = text.replace(/_([^_]+)_/g, '<i>$1</i>');
    }
    
    return text;
}

// Split message into chunks, preserving song groups
export function splitMessageBySong(message, maxLength = MAX_MESSAGE_LENGTH) {
    const chunks = [];
    // Split by double newline to preserve song groupings
    const songs = message.split("\n\n");

    let currentChunk = "";

    for (const song of songs) {
        // Check if adding this song would exceed max length
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
export function formatPlaylistChanges(oldMetadata, newMetadata) {
    // Use old playlist name in the header
    let message = `*✿ _${oldMetadata.name}_ updated! ✿*\n\n`;

    // Name change
    if (oldMetadata.name !== newMetadata.name) {
        message += `Name:\n_${oldMetadata.name}_ ➔ *${newMetadata.name}*\n\n`;
    }

    // Description change
    if (oldMetadata.description !== newMetadata.description) {
        message += `Description:\n`;
        message += oldMetadata.description ? `_${oldMetadata.description}_` : "(empty)";
        message += ` ➔ `;
        message += newMetadata.description ? `*${newMetadata.description}*` : "(empty)";
        message += `\n\n`;
    }

    // Image change
    if (oldMetadata.image !== newMetadata.image) {
        message += `*Image:* Changed\n`;
        
        // Add links to images if available
        if (oldMetadata.image && newMetadata.image) {
            message += `[Previous Image](${oldMetadata.image}) ➔ [New Image](${newMetadata.image})\n\n`;
        } else if (newMetadata.image) {
            message += `[New Image Added](${newMetadata.image})\n\n`;
        } else if (oldMetadata.image) {
            message += `[Image Removed](${oldMetadata.image})\n\n`;
        }
    }

    // Add link to playlist
    message += `[Open Playlist](https://open.spotify.com/playlist/${newMetadata.id})`;

    return message;
}
