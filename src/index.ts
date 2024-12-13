import express from "express";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import routing from "./routes/routing";
import spotifyRoutes from "./routes/spotifyRoutes"
import cookieParser from 'cookie-parser';
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const allowedOrigins = process.env.FRONTEND_LINK;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', "userid"],
  optionsSuccessStatus: 204
}));

app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/api/videos', express.static(path.join(__dirname, '../public/videos')));

mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("MongoDB connection error", error));

app.use("/api", routing);
app.use("/api", spotifyRoutes)

app.listen(PORT, () => {
  console.log(`Server is running on Port ${PORT}`);
});
