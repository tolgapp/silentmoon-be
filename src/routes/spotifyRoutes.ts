import { Router, Request, Response, NextFunction } from "express";
import axios, { AxiosError } from "axios";
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
  expires_in: number; // in seconds
}

// Middleware zur Validierung und Aktualisierung des Access Tokens
const validateAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  let accessToken = req.headers.authorization?.split(" ")[1];
  const refreshToken = req.headers["x-refresh-token"] as string;

  if (!accessToken) {
    return void res.status(401).json({ error: "Access token is required" });
  }

  // Optional: Überprüfen, ob das Token abgelaufen ist (Mock-Implementierung hier)
  // In einer echten App könntest du Token-Expiration-Daten speichern und darauf prüfen.
  const tokenExpired = false; // Simulierter Check (Ersetzen mit tatsächlicher Logik)

  if (tokenExpired && refreshToken) {
    try {
      // Fordere einen neuen Access Token mit dem Refresh Token an
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

      // Füge den neuen Access Token in den `res.locals` hinzu, damit er in der Route verwendet werden kann
      res.locals.accessToken = accessToken;

      // Optional: Aktualisiere den Token im Frontend, wenn nötig
      res.set("x-new-access-token", accessToken);
    } catch (error) {
      console.error("Failed to refresh Spotify access token:", error);
      return void res.status(401).json({ error: "Failed to refresh access token" });
    }
  } else {
    // Wenn das Token gültig ist, direkt weiter
    res.locals.accessToken = accessToken;
  }

  next();
};


router.post("/spotify/token", async (req: Request, res: Response) => {
  const { code, redirectUri } = req.body; // Der Code und die Redirect-URI kommen vom Client
    // console.log("CODE::::", code)
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

    
    // console.log("Sending request to Spotify with data:", data.toString());
  
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
    res.json({ access_token, refresh_token }); // Stelle sicher, dass hier kein Fehler auftritt
  } catch (error) {
    console.error("Error fetching Spotify token:", error);
  
    if (axios.isAxiosError(error)) {
      console.error("Axios error response:", error.response?.data); // Prüfe die vollständige Antwort
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

  
  

export default router;
