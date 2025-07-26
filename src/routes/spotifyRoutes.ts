import { Router } from 'express';
import { validateAccessToken } from '../middlewares/validateAccessToken';
import dotenv from 'dotenv';
import {
  addToFavorites,
  getFavoritePlaylistDetails,
  getPlaylistTracksById,
  getRandomAudio,
  getSpotifyPlaylists,
  getStatus,
  postSpotifyToken,
  removeFromFavorites,
} from '../controllers/spotifyController';

dotenv.config();

const router = Router();
export const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

router.post('/spotify/token', postSpotifyToken);

router.get('/spotify/playlists', validateAccessToken, validateAccessToken, getSpotifyPlaylists);
router.get('/spotify/playlists/:playlistId/tracks', validateAccessToken, getPlaylistTracksById);
router.get('/user/spotify-favorites/details', validateAccessToken, getFavoritePlaylistDetails);

router.post('/user/spotify-favorites/add', addToFavorites);
router.post('/user/spotify-favorites/remove', removeFromFavorites);

router.get('/user/spotify-favorites/status', getStatus);

router.get('/playlists/meditation/random-audio', validateAccessToken, getRandomAudio);

export default router;