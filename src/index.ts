import express from "express";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import routing from "./routes/routing";
import cookieParser from 'cookie-parser';
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const allowedOrigins = process.env.FRONTEND_LINK;

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

// Statische Routen für Bilder und Videos
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/videos', express.static(path.join(__dirname, '../public/videos')));

// MongoDB-Verbindung mit Mongoose
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("MongoDB connection error", error));

// Routen
app.use("/api", routing);

// Server-Start
app.listen(PORT, () => {
  console.log(`Server is running on Port ${PORT}`);
});
