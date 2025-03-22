// Function to format a date string in Philippine Time (UTC+8) with specific format
export function getTimestamp(dateString) {
    const date = dateString ? new Date(dateString) : new Date();
    
    return date.toLocaleString('en-PH', { 
        timeZone: 'Asia/Manila',
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
