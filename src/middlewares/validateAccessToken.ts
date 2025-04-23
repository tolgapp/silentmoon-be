import { Request, Response, NextFunction} from "express";
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from "../routes/spotifyRoutes";
import axios from "axios";

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export const validateAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  let accessToken = res.locals.accessToken || req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'] as string;

  if (!accessToken) {
    return void res.status(401).json({ error: 'Access token is required' });
  }

  const tokenExpiration = parseInt((req.headers['x-token-expiration'] as string) || '0', 10);
  const currentTime = Date.now();

  if (tokenExpiration && currentTime > tokenExpiration) {
    if (refreshToken) {
      try {
        const data = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: SPOTIFY_CLIENT_ID!,
          client_secret: SPOTIFY_CLIENT_SECRET!,
        });

        const response = await axios.post<SpotifyTokenResponse>(
          SPOTIFY_TOKEN_URL,
          data.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );

        accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in * 1000;
        const expirationTime = Date.now() + expiresIn;

        res.locals.accessToken = accessToken;
        res.locals.tokenExpiration = expirationTime;

        res.set('x-token-expiration', expirationTime.toString());
        res.set('x-new-access-token', accessToken);
      } catch (error) {
        console.error('Failed to refresh Spotify access token:', error);
        return void res.status(401).json({ error: 'Failed to refresh access token' });
      }
    } else {
      return void res
        .status(401)
        .json({ error: 'Token has expired and no refresh token available' });
    }
  } else {
    res.locals.accessToken = accessToken;
    res.locals.tokenExpiration = tokenExpiration;
  }

  next();
};