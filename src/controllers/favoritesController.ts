import { Request, Response } from 'express';
import { UserModel as User } from '../models/user.model';
import { AuthRequest, Video } from '../routes/routing';
import fs from 'fs';
import path from 'path';

export const addVideo = async (req: Request, res: Response): Promise<void> => {
  const { userId, contentId } = req.body;

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    return void res.status(400).json({ message: 'Invalid or missing userId' });
  }

  const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, '');

  try {
    const user = await User.findById(userId);
    if (!user) {
      return void res.status(404).json({ message: 'User not found' });
    }

    const exists = user.videoFavorites?.some(fav => fav.contentId === cleanedContentId);
    if (exists) {
      return void res.status(400).json({ message: 'Video already in favorites' });
    }

    user.videoFavorites = user.videoFavorites || [];
    user.videoFavorites.push({
      contentId: cleanedContentId,
      addedAt: new Date(),
    });

    await user.save();
    res.status(200).json({ message: 'Video added to favorites' });
  } catch (error) {
    console.error('Error in /favorites/video/add:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

export const removeVideo = async (req: Request, res: Response): Promise<void> => {
  const { userId, contentId } = req.body;

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    return void res.status(400).json({ message: 'Invalid or missing userId' });
  }

  const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, '');

  try {
    const user = await User.findById(userId);
    if (!user) {
      return void res.status(404).json({ message: 'User not found' });
    }

    user.videoFavorites = user.videoFavorites?.filter(fav => fav.contentId !== cleanedContentId);

    await user.save();
    res.status(204).send();
  } catch (error) {
    console.error('Error in /favorites/video/remove:', error);
    res.status(500).json({ message: 'Error removing video from favorites', error });
  }
}

export const checkFavoriteStatus = async (req: Request, res: Response): Promise<void> => {
  const { userId, contentId } = req.query as {
    userId: string;
    contentId: string;
  };

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/) || !contentId) {
    return void void res.status(400).json({ message: 'userId and contentId are required' });
  }

  const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, '');

  try {
    const user = await User.findById(userId);
    if (!user) {
      return void res.status(404).json({ message: 'User not found' });
    }

    const isFavorite = user.videoFavorites?.some(fav => fav.contentId === cleanedContentId);
    
    return void res.status(200).json({ isFavorite: !!isFavorite });
  } catch (error) {
    console.error('Error in /favoritevideos:', error);
    return void res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const userFavorites = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return void res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.videoFavorites) {
      return void res.status(404).json({ message: 'Favorites not found' });
    }

    const favoriteIds = user.videoFavorites.map(fav =>
      fav.contentId.replace(/^https?:\/\/[^/]+/, '')
    );

    const filePath = path.join(__dirname, '../data/videos.json');
    const yogaVideos: Video[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const favoriteVideos = yogaVideos.filter(video =>
      favoriteIds.includes(video.videoUrl.replace(/^https?:\/\/[^/]+/, ''))
    );

    return void res.status(200).json(favoriteVideos);
  } catch (error) {
    console.error('Error retrieving favorites:', error);
    return void res.status(500).json({ message: 'Error retrieving favorites' });
  }
};