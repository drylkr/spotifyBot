import axios from "axios";
import { escapeMarkdown } from "../utils/markdownUtils.js";

// Send Telegram notification
export async function sendTelegramMessage(message, telegramToken, telegramChatId) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: telegramChatId,
            text: message,
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true
        });
        console.log("Notification sent successfully");
    } catch (error) {
        console.error("Error sending Telegram message:", error.response?.data || error.message);
    }
}
