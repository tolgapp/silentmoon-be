import { Response, Request } from 'express';
import {
  SPOTIFY_API_BASE_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} from '../routes/spotifyRoutes';
import { UserModel as User } from '../models/user.model';
import axios, { AxiosError } from 'axios';

export const postSpotifyToken = async (req: Request, res: Response) => {
  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) {
    return void res.status(400).json({ error: 'Code and Redirect URI are required' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return void res.status(500).json({ error: 'Spotify Client ID and Secret are required' });
  }
  try {
    const data = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    });

    const response = await axios.post('https://accounts.spotify.com/api/token', data.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token } = response.data;
    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error('Error fetching Spotify token:', error);

    if (axios.isAxiosError(error)) {
      console.error('Axios error response:', error.response?.data);
      return void res.status(500).json({
        error: error.response?.data || 'Failed to fetch Spotify token',
      });
    }

    return void res.status(500).json({ error: 'An unknown error occurred.' });
  }
};

export const getSpotifyPlaylists = async (req: Request, res: Response) => {
  const accessToken = res.locals.accessToken;
  const query = req.query.q || 'meditation';

  try {
    const response = await axios.get(`${SPOTIFY_API_BASE_URL}/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        q: query,
        type: 'playlist',
        limit: 10,
        market: 'DE',
      },
    });

    const playlists = response.data.playlists.items || [];

    return void res.status(200).json({ playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

export const getPlaylistTracksById = async (req: Request, res: Response) => {
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
    const axiosError = error as AxiosError;

    console.error('Error fetching tracks from Spotify:', axiosError);

    if (axiosError.response) {
      console.error('Spotify API response error:', axiosError.response.data);
      return void res.status(500).send(axiosError.response.data);
    } else if (axiosError.request) {
      console.error('No response received from Spotify:', axiosError.request);
      return void res.status(500).send('No response from Spotify API');
    } else {
      console.error('Error during request setup:', axiosError.message);
      return void res.status(500).send('Error fetching data from Spotify');
    }
  }
};

export const getFavoritePlaylistDetails = async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return void res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.spotifyFavorites?.length) {
      return void res.status(404).json({ message: 'No favorites found for this user.' });
    }

    const accessToken = res.locals.accessToken;

    const favoriteDetailsPromises = user.spotifyFavorites.map(async favorite => {
      try {
        const response = await axios.get(
          `${SPOTIFY_API_BASE_URL}/playlists/${favorite.contentId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

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
    console.error('Error fetching favorite details:', error);
    res.status(500).json({ message: 'Error fetching favorite details.', error });
  }
};


export const addToFavorites = async (req: Request, res: Response) => {
  const { userId, contentId, playlistName } = req.body;

  // Input validation
  if (
    typeof userId !== 'string' ||
    typeof contentId !== 'string' ||
    typeof playlistName !== 'string'
  ) {
    return void res.status(400).json({
      message: 'Invalid input: userId, contentId, and playlistName must be strings.',
    });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return void res.status(404).json({ message: 'User not found.' });
    }

    const alreadyExists = user.spotifyFavorites?.some(
      (fav: { contentId: string }) => fav.contentId === contentId
    );

    if (alreadyExists) {
      return void res.status(409).json({ message: 'Playlist is already in favorites.' });
    }

    const favorite = {
      contentId,
      playlistName,
      addedAt: new Date(),
    };

    user.spotifyFavorites?.push(favorite);

    await user.save();

    res.status(201).json({
      message: 'Playlist added to favorites successfully.',
      favorite,
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({
      message: 'Internal server error while adding favorite.',
      error: (error as Error).message,
    });
  }
}

export const removeFromFavorites = async (req: Request, res: Response) => {
  const { userId, contentId } = req.body;

  if (!userId || !contentId) {
    return void res.status(400).json({ message: 'User ID and Content ID are required.' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return void res.status(404).json({ message: 'User not found.' });
    }

    const initialLength = user.spotifyFavorites?.length || 0;
    user.spotifyFavorites = user.spotifyFavorites?.filter(
      favorite => favorite.contentId !== contentId
    );

    if (initialLength === user.spotifyFavorites?.length) {
      return void res.status(400).json({ message: 'Playlist not found in favorites.' });
    }

    await user.save();
    res.status(200).json({ message: 'Playlist removed from favorites.' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing favorite.', error });
  }
}

export const getStatus = async (req: Request, res: Response) => {
  const { userId, contentId } = req.query;

  if (!userId || !contentId) {
    return void res.status(400).json({ message: 'User ID and Content ID are required.' });
  }

  try {
    const user = await User.findById(userId.toString());

    if (!user) {
      return void res.status(404).json({ message: 'User not found.' });
    }

    const exists = user.spotifyFavorites?.some(favorite => favorite.contentId === contentId);

    res.status(200).json({ isFavorite: !!exists });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({ message: 'Error checking favorite status.', error });
  }
};

export const getRandomAudio = async (req: Request, res: Response) => {
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

      if (!playlists.length) {
        console.error('No playlists found');
        return void res.status(404).json({ error: 'No meditation playlists found' });
      }
      let randomPlaylist;

      do {
        randomPlaylist = playlists[Math.floor(Math.random() * playlists.length)];
      } while (!randomPlaylist);

      if (!randomPlaylist || !randomPlaylist.id) {
        console.error('Random playlist selection failed:', randomPlaylist);
        return void res.status(500).json({ error: 'Failed to select a random playlist' });
      }

      const tracksResponse = await axios.get(
        `${SPOTIFY_API_BASE_URL}/playlists/${randomPlaylist.id}/tracks`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const tracks = tracksResponse.data.items || [];
      if (!tracks.length) {
        console.error('No tracks found in the playlist:', randomPlaylist.id);
        return void res.status(404).json({ error: 'No tracks found in the playlist' });
      }

      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      if (!randomTrack || !randomTrack.track || !randomTrack.track.uri) {
        console.error('Random track selection failed:', randomTrack);
        return void res.status(500).json({ error: 'Failed to select a random track' });
      }

      res.status(200).json({
        playlist: {
          name: randomPlaylist.name,
          uri: randomPlaylist.uri,
        },
        track: {
          name: randomTrack.track.name,
          uri: randomTrack.track.uri,
          artist: randomTrack.track.artists.map((artist: any) => artist.name).join(', '),
          album: randomTrack.track.album.name,
        },
      });
    } catch (error) {
      console.error('Error fetching random meditation audio:', error);
      res.status(500).json({ error: 'Failed to fetch random meditation audio' });
    }
  }