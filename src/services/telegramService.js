import axios from "axios";

const MAX_MESSAGE_LENGTH = 4000;

export async function sendTelegramMessage(message, telegramToken, telegramChatId) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    try {
        // First split the message into chunks to ensure we don't break song groups
        const rawChunks = splitMessageBySong(message, MAX_MESSAGE_LENGTH);
        
        // Process each chunk individually
        for (const [index, chunk] of rawChunks.entries()) {
            // Process Spotify links in this chunk
            let processedChunk = processSpotifyLinks(chunk);
            
            // Remove any existing backslashes that might be escaping characters
            processedChunk = processedChunk.replace(/\\([()[\]*.!_~])/g, '$1');
            
            // Format as HTML
            let textToSend = formatAsHtml(processedChunk);
            
            // Add "Part X" label only if there are multiple parts
            if (rawChunks.length > 1) {
                textToSend = `<b>Part ${index + 1}/${rawChunks.length}:</b>\n\n${textToSend}`;
            }
            
            try {
                const response = await axios.post(url, {
                    chat_id: telegramChatId,
                    text: textToSend,
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                });
                console.log(`Part ${index + 1} sent successfully with HTML parsing`);
            } catch (error) {
                console.error(`Error sending part ${index + 1} with HTML:`, error.response?.data || error.message);
                console.error("HTML content that failed:", textToSend);
                
                // Remove all HTML tags for plain text fallback
                const plainText = textToSend.replace(/<[^>]*>/g, '');
                
                try {
                    await axios.post(url, {
                        chat_id: telegramChatId,
                        text: plainText,
                        disable_web_page_preview: true
                    });
                    console.log(`Part ${index + 1} sent as plain text`);
                } catch (fallbackError) {
                    console.error(`Fallback also failed for part ${index + 1}:`, fallbackError.message);
                }
            }

            if (index < rawChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Notification sent successfully in ${rawChunks.length} parts`);
    } catch (error) {
        console.error("Error sending Telegram message:", error.response?.data || error.message);
    }
}

// Process Spotify links to ensure they are properly formatted
function processSpotifyLinks(text) {
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
function formatAsHtml(text) {
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

function splitMessageBySong(message, maxLength) {
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
