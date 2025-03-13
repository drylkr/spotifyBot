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

// Fetch playlist tracks
export async function getPlaylistTracks(playlistId, token) {
    try {
        const response = await axios.get(
            `https://api.spotify.com/v1/playlists/${playlistId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const playlistName = response.data.name;
        const tracks = response.data.tracks.items.map((item) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists.map((a) => a.name).join(", "),
            url: item.track.external_urls.spotify,
            added_at: item.added_at,
        }));

        return { playlistName, tracks };
    } catch (error) {
        console.error(`Error fetching playlist ${playlistId}:`, error.response?.data || error.message);
        return null;
    }
}
