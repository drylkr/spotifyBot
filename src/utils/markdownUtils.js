// Escape special characters for Telegram MarkdownV2
export function escapeMarkdown(text) {
    if (!text) return "";
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
