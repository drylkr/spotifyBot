import axios from "axios";

const MAX_MESSAGE_LENGTH = 4000;

export async function sendTelegramMessage(message, telegramToken, telegramChatId) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    try {
        // Pre-process the message to fix spotify links
        let processedMessage = message;
        
        // Fix Spotify links - make sure they're properly formatted as HTML
        const spotifyMatches = processedMessage.match(/Listen on Spotify/g);
        const urlMatches = processedMessage.match(/(https:\/\/open\.spotify\.com\/[^\s]+)/g);
        
        if (spotifyMatches && urlMatches && spotifyMatches.length === urlMatches.length) {
            // Replace all "Listen on Spotify" with HTML links
            let urlIndex = 0;
            processedMessage = processedMessage.replace(/Listen on Spotify/g, () => {
                const url = urlMatches[urlIndex++];
                return `<a href="${url}">Listen on Spotify</a>`;
            });
        }
        
        // Split the message into chunks
        const messageChunks = splitMessageBySong(processedMessage, MAX_MESSAGE_LENGTH);

        // Send each chunk
        for (const [index, chunk] of messageChunks.entries()) {
            let textToSend = chunk;

            // Add "Part X" label only if there are multiple parts
            if (messageChunks.length > 1) {
                textToSend = `<b>Part ${index + 1}/${messageChunks.length}:</b>\n\n${chunk}`;
            }

            // Convert any existing Markdown to HTML
            textToSend = formatAsHtml(textToSend);
            
            try {
                const response = await axios.post(url, {
                    chat_id: telegramChatId,
                    text: textToSend,
                    parse_mode: "HTML",
                    disable_web_page_preview: false
                });
                console.log(`Part ${index + 1} sent successfully with HTML parsing`);
            } catch (error) {
                console.error(`Error sending part ${index + 1} with HTML:`, error.response?.data || error.message);
                
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

            if (index < messageChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Notification sent successfully in ${messageChunks.length} parts`);
    } catch (error) {
        console.error("Error sending Telegram message:", error.response?.data || error.message);
    }
}

// Format the message as HTML
function formatAsHtml(text) {
    if (!text) return "";
    
    // Remove any existing backslashes that might be escaping characters
    text = text.replace(/\\([()[\]*.!_~])/g, '$1');
    
    // Replace Markdown links with HTML links (if not already HTML)
    if (!text.includes('<a href=')) {
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
    }
    
    // Replace Markdown bold with HTML bold (if not already HTML)
    if (!text.includes('<b>')) {
        text = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
    }
    
    // Replace Markdown italic with HTML italic (if not already HTML)
    if (!text.includes('<i>')) {
        text = text.replace(/_(.*?)_/g, '<i>$1</i>');
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
