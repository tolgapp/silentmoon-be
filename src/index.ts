import express, { Request, Response } from 'express';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import routing from './routes/routing';
import spotifyRoutes from './routes/spotifyRoutes';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();

const app = express();
const allowedOrigins = process.env.FRONTEND_LINK;

app.use(express.json());
app.use(cookieParser());
console.log('Allowed Origins:', allowedOrigins);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'userid'],
    optionsSuccessStatus: 204,
  })
);

app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/api/videos', express.static(path.join(__dirname, '../public/videos')));

mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log('Connected to MongoDB'))
  .catch(error => console.log('MongoDB connection error', error));

app.use('/api', routing);
app.use('/api', spotifyRoutes);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5002;
  app.listen(PORT, () => {
    console.log(`Server running on Port ${PORT}`);
  });
}

export default app;
