import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import routing from "./routes/routing"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware for parsing json
app.use(express.json());

// MongoDB connection with mongoose
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("MongoDB connection error", error));

// Routes
app.use("/api", routing)

// Server listening
app.listen(PORT, () => {
  console.log(`Server is running on Port ${PORT}`);
});
