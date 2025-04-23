import { Router, Request, Response } from 'express';
import dotenv from 'dotenv';
import { login, logout, protectedRoutes, signup } from '../controllers/authController';
import { meditation, yogaVideos } from '../controllers/dataController';
import { verifyToken } from '../middlewares/verifyToken';
import { getSettingsRoute, postSettingsRoute, putSettingsRoute } from '../controllers/settingsController';
import { addVideo, checkFavoriteStatus, removeVideo, userFavorites } from '../controllers/favoritesController';

export interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

export interface Video {
  id: number;
  title: string;
  url: string;
  videoUrl: string;
}

dotenv.config();
const router = Router();

router.post('/', (req: Request, res: Response) => {
  res.status(201).send('Welcome to Silentmoon!');
});

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);

router.get('/protected', verifyToken, protectedRoutes);
router.get('/yogavideos', verifyToken, yogaVideos)
router.get('/meditation', verifyToken, meditation);

router.get('/settings', verifyToken, getSettingsRoute);
router.post('/settings', verifyToken, postSettingsRoute);
router.put('/settings', verifyToken, putSettingsRoute);

router.post('/favorites/video/add', addVideo);
router.post('/favorites/video/remove', removeVideo);

router.get('/favorites', verifyToken, userFavorites);
router.get('/checkFavoriteStatus', checkFavoriteStatus);

export default router;
