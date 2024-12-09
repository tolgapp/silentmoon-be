import { Router, Request, Response, NextFunction } from "express";
import axios, { AxiosError } from "axios";
import { UserModel as User } from "../models/user.model";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; 
}


const validateAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  let accessToken = res.locals.accessToken || req.headers.authorization?.split(" ")[1];
  const refreshToken = req.headers["x-refresh-token"] as string;

  if (!accessToken) {
    return void res.status(401).json({ error: "Access token is required" });
  }

  const tokenExpiration = parseInt(req.headers["x-token-expiration"] as string || "0", 10);
  const currentTime = Date.now();

  if (tokenExpiration && currentTime > tokenExpiration) {
    if (refreshToken) {
      try {
        const data = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: SPOTIFY_CLIENT_ID!,
          client_secret: SPOTIFY_CLIENT_SECRET!,
        });

        const response = await axios.post<SpotifyTokenResponse>(
          SPOTIFY_TOKEN_URL,
          data.toString(),
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          }
        );

        accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in * 1000; // in Millisekunden
        const expirationTime = Date.now() + expiresIn;

        res.locals.accessToken = accessToken;
        res.locals.tokenExpiration = expirationTime;

        res.set("x-token-expiration", expirationTime.toString());
        res.set("x-new-access-token", accessToken);
      } catch (error) {
        console.error("Failed to refresh Spotify access token:", error);
        return void res.status(401).json({ error: "Failed to refresh access token" });
      }
    } else {
      return void res.status(401).json({ error: "Token has expired and no refresh token available" });
    }
  } else {
    res.locals.accessToken = accessToken;
    res.locals.tokenExpiration = tokenExpiration;
  }

  next();
};


router.post("/spotify/token", async (req: Request, res: Response) => {
  const { code, redirectUri } = req.body; 
  if (!code || !redirectUri) {
    return void res.status(400).json({ error: "Code and Redirect URI are required" });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return void res
      .status(500)
      .json({ error: "Spotify Client ID and Secret are required" });
  }
  try {
    const data = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    });

    
  
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      data.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
  
    const { access_token, refresh_token } = response.data;
    res.json({ access_token, refresh_token }); 
  } catch (error) {
    console.error("Error fetching Spotify token:", error);
  
    if (axios.isAxiosError(error)) {
      console.error("Axios error response:", error.response?.data); 
      return void res.status(500).json({
        error: error.response?.data || "Failed to fetch Spotify token",
      });
    }
  
    return void res.status(500).json({ error: "An unknown error occurred." });
  }
  
});

router.get("/spotify/playlists", validateAccessToken, async (req: Request, res: Response) => {
  const accessToken = res.locals.accessToken;
  const query = req.query.q || "meditation";

  try {
    const response = await axios.get(`${SPOTIFY_API_BASE_URL}/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        
       q: query, 
        type: "playlist",
        limit: 10,
        market: "DE"
      },
    });

    const playlists = response.data.playlists.items || [];

    return void res.status(200).json({ playlists });
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

router.get('/spotify/playlists/:playlistId/tracks', async (req, res) => {
  const playlistId = req.params.playlistId;
  const accessToken = req.headers.authorization?.split(' ')[1];
  if (!accessToken) {
    return void res.status(400).send('Access token is missing');
  }

  try {
    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    res.json(response.data); 
  } catch (error) {
    // Typisierung des Fehlerobjekts als AxiosError
    const axiosError = error as AxiosError;

    console.error('Error fetching tracks from Spotify:', axiosError);

    if (axiosError.response) {
      console.error("Spotify API response error:", axiosError.response.data);
      return void res.status(500).send(axiosError.response.data); // Detaillierte Fehlerantwort von Spotify zurückgeben
    } else if (axiosError.request) {
      console.error("No response received from Spotify:", axiosError.request);
      return void res.status(500).send('No response from Spotify API');
    } else {
      console.error("Error during request setup:", axiosError.message);
      return void res.status(500).send('Error fetching data from Spotify');
    }
  }
});

router.post("/user/spotify-favorites/add", async (req: Request, res: Response) => {
  console.log("POST userID", req.body)

  const { userId, contentId , playlistName} = req.body;

  if (!userId || !contentId || !playlistName) {
    return void res.status(400).json({ message: "User ID, Content ID, and Playlist Name are required." });
  }  

  try {
    const user = await User.findById(userId);

    if (!user) {
      return void res.status(404).json({ message: "User not found." });
    }

    const exists = user.spotifyFavorites?.some(
      (favorite) => favorite.contentId === contentId
    );

    if (exists) {
      return void res.status(400).json({ message: "Playlist is already in favorites." });
    }

    user.spotifyFavorites?.push({ contentId, playlistName, addedAt: new Date() });
    await user.save();

    res.status(200).json({ message: "Playlist added to favorites." });
  } catch (error) {
    res.status(500).json({ message: "Error adding favorite.", error });
  }
});

router.get("/user/spotify-favorites/details", validateAccessToken, async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return void res.status(400).json({ message: "User ID is required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.spotifyFavorites?.length) {
      return void res.status(404).json({ message: "No favorites found for this user." });
    }

    const accessToken = res.locals.accessToken;

    const favoriteDetailsPromises = user.spotifyFavorites.map(async (favorite) => {
      try {
        const response = await axios.get(`${SPOTIFY_API_BASE_URL}/playlists/${favorite.contentId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const data = response.data;

        return {
          id: data.id,
          name: data.name,
          image: data.images[0]?.url,
          description: data.description,
          uri: data.uri, 
          tracks: data.tracks,
          addedAt: favorite.addedAt,
        };
      } catch (error) {
        console.error(`Error fetching details for playlist ${favorite.contentId}:`, error);
        return null; 
      }
    });

    const favoritesDetails = await Promise.all(favoriteDetailsPromises);

    const filteredFavorites = favoritesDetails.filter(Boolean);

    res.status(200).json(filteredFavorites);
  } catch (error) {
    console.error("Error fetching favorite details:", error);
    res.status(500).json({ message: "Error fetching favorite details.", error });
  }
});

router.get("/playlists/meditation/random-audio", validateAccessToken, async (req: Request, res: Response) => {
  try {
    const accessToken = res.locals.accessToken;

    const playlistsResponse = await axios.get(
      `${SPOTIFY_API_BASE_URL}/search?q=meditation&type=playlist&limit=20&market=DE`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const playlists = playlistsResponse.data.playlists?.items || [];
    console.log(playlists)
    if (!playlists.length) {
      console.error("No playlists found");
      return void res.status(404).json({ error: "No meditation playlists found" });
    }

    const randomPlaylist = playlists[Math.floor(Math.random() * playlists.length)];
    if (!randomPlaylist || !randomPlaylist.id) {
      console.error("Random playlist selection failed:", randomPlaylist);
      return void res.status(500).json({ error: "Failed to select a random playlist" });
    }

    const tracksResponse = await axios.get(`${SPOTIFY_API_BASE_URL}/playlists/${randomPlaylist.id}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const tracks = tracksResponse.data.items || [];
    if (!tracks.length) {
      console.error("No tracks found in the playlist:", randomPlaylist.id);
      return void res.status(404).json({ error: "No tracks found in the playlist" });
    }

    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    if (!randomTrack || !randomTrack.track || !randomTrack.track.uri) {
      console.error("Random track selection failed:", randomTrack);
      return void res.status(500).json({ error: "Failed to select a random track" });
    }

    res.status(200).json({
      playlist: {
        name: randomPlaylist.name,
        uri: randomPlaylist.uri,
      },
      track: {
        name: randomTrack.track.name,
        uri: randomTrack.track.uri,
        artist: randomTrack.track.artists.map((artist: any) => artist.name).join(", "),
        album: randomTrack.track.album.name,
      },
    });
  } catch (error) {
    console.error("Error fetching random meditation audio:", error);
    res.status(500).json({ error: "Failed to fetch random meditation audio" });
  }
});



export default router;
