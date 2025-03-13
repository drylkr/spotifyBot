// Function to get the current timestamp in Philippine Time (UTC+8)
export function getTimestamp() {
    return new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}