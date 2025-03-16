import axios from "axios";

// Get Spotify API token
export async function getSpotifyToken(clientId, clientSecret) {
    try {
        const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("Error getting Spotify token:", error.response?.data || error.message);
        return null;
    }
}

// Fetch complete playlist details including metadata
export async function getPlaylistDetails(playlistId, token) {
    try {
        const response = await axios.get(
            `https://api.spotify.com/v1/playlists/${playlistId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // Extract playlist metadata
        const metadata = {
            id: response.data.id,
            name: response.data.name,
            description: response.data.description || "",
            public: response.data.public,
            followers: response.data.followers?.total || 0,
            image: response.data.images?.length > 0 ? response.data.images[0].url : null,
            owner: {
                id: response.data.owner?.id,
                name: response.data.owner?.display_name
            },
            snapshot_id: response.data.snapshot_id,
            last_checked: new Date().toISOString()
        };

        // Extract tracks
        const tracks = response.data.tracks.items.map((item) => ({
            id: item.track?.id || "removed",
            name: item.track?.name || "Unavailable Track",
            artist: item.track?.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
            url: item.track?.external_urls?.spotify || null,
            added_at: item.added_at,
        })).filter(track => track.id !== "removed"); // Filter out null tracks

        return { 
            metadata,
            tracks 
        };
    } catch (error) {
        console.error(`Error fetching playlist ${playlistId}:`, error.response?.data || error.message);
        return null;
    }
}

// For backward compatibility
export async function getPlaylistTracks(playlistId, token) {
    const result = await getPlaylistDetails(playlistId, token);
    if (!result) return null;
    
    return {
        playlistName: result.metadata.name,
        tracks: result.tracks
    };
}
