import { Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from '../routes/routing';
import jwt from 'jsonwebtoken';

export const verifyToken: RequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies['token'];
  if (!token) {
    res.status(401).send('Access denied');
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    res.status(403).send('Invalid token');
  }
};
