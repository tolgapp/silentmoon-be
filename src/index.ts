import express from 'express';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import routing from './routes/routing';
import spotifyRoutes from './routes/spotifyRoutes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { VercelRequest, VercelResponse } from '@vercel/node';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const allowedOrigins = process.env.FRONTEND_LINK;

app.use(express.json());
app.use(cookieParser());

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

app.use('/api', routing);
app.use('/api', spotifyRoutes);

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI as string);
  isConnected = true;
}

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Running @ http://localhost:${PORT}`);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  return app(req, res);
}
