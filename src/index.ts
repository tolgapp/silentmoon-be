import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import routing from "./routes/routing";
import cookieParser from 'cookie-parser';
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const allowedOrigins = process.env.FRONTEND_LINK;

// Middleware for parsing json
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
    optionsSuccessStatus: 204
  })
);

// MongoDB connection with mongoose
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("MongoDB connection error", error));


// Routes
app.use("/api", routing);

// Server listening
app.listen(PORT, () => {
  console.log(`Server is running on Port ${PORT}`);
});
