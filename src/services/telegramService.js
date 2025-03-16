import axios from "axios";
import { 
    MAX_MESSAGE_LENGTH, 
    processSpotifyLinks, 
    formatAsHtml, 
    splitMessageBySong 
} from "../utils/htmlUtils.js";

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

// Send an image with caption
export async function sendTelegramPhoto(photoUrl, caption, telegramToken, telegramChatId) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendPhoto`;
    
    try {
        // Format caption as HTML
        const formattedCaption = formatAsHtml(caption);
        
        const response = await axios.post(url, {
            chat_id: telegramChatId,
            photo: photoUrl,
            caption: formattedCaption,
            parse_mode: "HTML"
        });
        
        console.log("Photo sent successfully");
        return true;
    } catch (error) {
        console.error("Error sending Telegram photo:", error.response?.data || error.message);
        
        // Fallback to message with link
        try {
            const message = `${caption}\n\n[View Image](${photoUrl})`;
            await sendTelegramMessage(message, telegramToken, telegramChatId);
            return true;
        } catch (fallbackError) {
            console.error("Fallback message also failed:", fallbackError.message);
            return false;
        }
    }
}
