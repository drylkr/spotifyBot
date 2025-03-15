// Function to format a date string in Philippine Time (UTC+8) with specific format
export function getTimestamp(dateString) {
    // If a date string is provided, use it; otherwise use current date
    const date = dateString ? new Date(dateString) : new Date();
    
    // Format the date in Philippine Time with your preferred format
    return date.toLocaleString('en-PH', { 
        timeZone: 'Asia/Manila',
        hour12: false, // This enables 24-hour format (military time)
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
