import axios from "axios";
import { escapeMarkdown } from "../utils/markdownUtils.js";

const MAX_MESSAGE_LENGTH = 4000;

export async function sendTelegramMessage(message, telegramToken, telegramChatId) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    try {
        const messageChunks = splitMessageBySong(message, MAX_MESSAGE_LENGTH);

        for (const [index, chunk] of messageChunks.entries()) {
            const escapedChunk = escapeMarkdown(chunk); 

            await axios.post(url, {
                chat_id: telegramChatId,
                text: `*Part ${index + 1}/${messageChunks.length}:*\n\n${escapedChunk}`,
                parse_mode: "MarkdownV2",
                disable_web_page_preview: true
            });

            if (index < messageChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Notification sent successfully in ${messageChunks.length} parts`);
    } catch (error) {
        console.error("Error sending Telegram message:", error.response?.data || error.message);
    }
}

function splitMessageBySong(message, maxLength) {
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
