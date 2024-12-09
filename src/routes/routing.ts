import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { UserModel as User } from "../models/user.model";

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

interface Video {
  id: number;
  title: string;
  url: string;
  videoUrl: string;
}

dotenv.config();
const router = Router();
const secretKey = process.env.JWT_SECRET;

if (!secretKey) {
  throw new Error("JWT_SECRET is not defined!");
}

const verifyToken: RequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies["token"];
  if (!token) {
    res.status(401).send("Access denied");
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    res.status(403).send("Invalid token");
  }
};

// Welcome route
router.post("/", (req: Request, res: Response) => {
  res.status(201).send("Welcome to Silentmoon!");
});

// User registration
router.post("/signup", async (req: Request, res: Response): Promise<void> => {
  const { name, surname, email, password } = req.body;

  if (!name || !surname || !email || !password) {
    return void res.status(400).send("Each input field must be filled out.");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return void res.status(409).send("Choose another email.");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      surname,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    return void res.status(201).send("Successfully registered!");
  } catch (error) {
    console.error(error);
    return void res.status(500).send("Register error.");
  }
});

// User authentication
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return void res.status(400).send("Email and password are required");
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return void res.status(401).send("Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return void res.status(401).send("Invalid email or password");
    }

    const token = jwt.sign({ id: user._id }, secretKey, { expiresIn: "1h" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return void res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hasCompletedSettings: user.hasCompletedSettings,
      },
    });
  } catch (error) {
    console.error(error);
    return void res.status(500).send("Login error");
  }
});

router.post("/logout", (req: Request, res: Response) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.status(200).json({ message: "Logout erfolgreich" });
  } catch (error) {
    console.error("Fehler beim Logout:", error);
    res.status(500).json({ message: "Interner Fehler beim Logout" });
  }
});

router.get(
  "/protected",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(400).send("User ID not found.");
        return;
      }

      const user = await User.findById(req.user.id).select("name");
      if (!user) {
        return void res.status(404).send("User not found.");
      }

      res.status(200).json({
        message: "You are authenticated",
        userName: user.name,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      res.status(500).send("Error fetching user data.");
    }
  }
);

router.get("/yogavideos", verifyToken, (req: Request, res: Response) => {
  const filePath = path.join(__dirname, "../data/videos.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Fehler beim Lesen der yogaVideos.json-Datei:", err);
      res.status(500).json({ message: "Fehler beim Abrufen der Yoga-Videos." });
      return;
    }

    try {
      const yogaVideos = JSON.parse(data);
      res.status(200).json(yogaVideos);
    } catch (parseError) {
      console.error(
        "Fehler beim Verarbeiten der yogaVideos.json-Datei:",
        parseError
      );
      res
        .status(500)
        .json({ message: "Fehler beim Verarbeiten der Yoga-Videos." });
    }
  });
});

router.get("/meditation", verifyToken, (req: Request, res: Response) => {
  const filePath = path.join(__dirname, "../data/meditate.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Fehler beim Lesen der meditate.json-Datei:", err);
      res.status(500).json({ message: "Fehler beim Abrufen der Yoga-Videos." });
      return;
    }

    try {
      const meditateData = JSON.parse(data);
      res.status(200).json(meditateData);
    } catch (parseError) {
      console.error(
        "Fehler beim Verarbeiten der yogaVideos.json-Datei:",
        parseError
      );
      res
        .status(500)
        .json({ message: "Fehler beim Verarbeiten der Yoga-Videos." });
    }
  });
});

// Settings - Create & Update
router.post(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { time, days } = req.body;

    if (!time || !Array.isArray(days)) {
      return void res
        .status(400)
        .json({ message: "Time and days are required." });
    }

    if (!userId) {
      return void res.status(400).json({ message: "User ID is required." });
    }

    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { time, days, hasCompletedSettings: true },
        { new: true }
      );

      if (!updatedUser) {
        return void res.status(404).json({ message: "User not found." });
      }

      return void res.status(201).json({
        message: "Settings successfully saved.",
        time: updatedUser.time,
        days: updatedUser.days,
        user: {
          hasCompletedSettings: updatedUser.hasCompletedSettings,
        },
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      return void res.status(500).json({ message: "Error saving settings." });
    }
  }
);

router.put(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { time, days } = req.body;

    if (!userId) {
      return void res.status(400).json({ message: "User ID is required." });
    }

    if (!time || !Array.isArray(days)) {
      return void res
        .status(400)
        .json({ message: "Time and days are required." });
    }

    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { time, days },
        { new: true }
      );

      if (!updatedUser) {
        return void res.status(404).json({ message: "User not found." });
      }

      return void res.status(200).json({
        message: "Settings successfully updated.",
        time: updatedUser.time,
        days: updatedUser.days,
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      return void res.status(500).json({ message: "Error updating settings." });
    }
  }
);

router.get(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      return void res.status(400).json({ message: "User ID is required." });
    }

    try {
      const user = await User.findById(userId).select(
        "time days hasCompletedSettings"
      );

      if (!user) {
        return void res.status(404).json({ message: "User not found." });
      }

      return void res.status(200).json({
        time: user.time,
        days: user.days,
        hasCompletedSettings: user.hasCompletedSettings,
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      return void res.status(500).json({ message: "Error fetching settings." });
    }
  }
);

// Home
router.get("/home", verifyToken, (req: Request, res: Response) => {
  const homeData = {
    message: "Welcome to Silent Moon!",
  };

  res.status(200).json(homeData);
});

// **** Favorites Video Routes ****
router.post(
  "/favorites/video/add",
  async (req: Request, res: Response): Promise<void> => {
    const { userId, contentId } = req.body;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return void res
        .status(400)
        .json({ message: "Invalid or missing userId" });
    }

    const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, "");

    try {
      const user = await User.findById(userId);
      if (!user) {
        return void res.status(404).json({ message: "User not found" });
      }

      const exists = user.videoFavorites?.some(
        (fav) => fav.contentId === cleanedContentId
      );
      if (exists) {
        return void res
          .status(400)
          .json({ message: "Video already in favorites" });
      }

      user.videoFavorites = user.videoFavorites || [];
      user.videoFavorites.push({
        contentId: cleanedContentId,
        addedAt: new Date(),
      });

      await user.save();
      res.status(200).json({ message: "Video added to favorites" });
    } catch (error) {
      console.error("Error in /favorites/video/add:", error);
      res.status(500).json({ message: "Internal server error", error });
    }
  }
);

router.post(
  "/favorites/video/remove",
  async (req: Request, res: Response): Promise<void> => {
    const { userId, contentId } = req.body;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return void res
        .status(400)
        .json({ message: "Invalid or missing userId" });
    }

    const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, "");

    try {
      const user = await User.findById(userId);
      if (!user) {
        return void res.status(404).json({ message: "User not found" });
      }

      user.videoFavorites = user.videoFavorites?.filter(
        (fav) => fav.contentId !== cleanedContentId
      );

      await user.save();
      res.status(204).send(); // Keine Nachricht zurückgeben, nur Status 204
    } catch (error) {
      console.error("Error in /favorites/video/remove:", error);
      res
        .status(500)
        .json({ message: "Error removing video from favorites", error });
    }
  }
);

router.get(
  "/favoritevideos",
  async (req: Request, res: Response): Promise<void> => {
    const { userId, contentId } = req.query as {
      userId: string;
      contentId: string;
    };

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/) || !contentId) {
      return void void res
        .status(400)
        .json({ message: "userId and contentId are required" });
    }

    const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, "");

    try {
      const user = await User.findById(userId);
      if (!user) {
        return void res.status(404).json({ message: "User not found" });
      }

      // Check if the video is in the user's favorites
      const isFavorite = user.videoFavorites?.some(
        (fav) => fav.contentId === cleanedContentId
      );

      // Send response based on whether the video is in the favorites
      return void res.status(200).json({ isFavorite: !!isFavorite });
    } catch (error) {
      console.error("Error in /favoritevideos:", error);
      return void res.status(500).json({
        message: "Server error",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

router.get(
  "/favorites",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return void res
        .status(400)
        .json({ message: "Benutzer-ID ist erforderlich" });
    }

    try {
      const user = await User.findById(userId);
      if (!user || !user.videoFavorites) {
        return void res
          .status(404)
          .json({ message: "Favoriten nicht gefunden" });
      }

      const favoriteIds = user.videoFavorites.map((fav) =>
        fav.contentId.replace(/^https?:\/\/[^/]+/, "")
      );

      const filePath = path.join(__dirname, "../data/videos.json");
      const yogaVideos: Video[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

      const favoriteVideos = yogaVideos.filter((video) =>
        favoriteIds.includes(video.videoUrl.replace(/^https?:\/\/[^/]+/, ""))
      );

      return void res.status(200).json(favoriteVideos);
    } catch (error) {
      console.error("Fehler beim Abrufen der Favoriten:", error);
      return void res
        .status(500)
        .json({ message: "Fehler beim Abrufen der Favoriten" });
    }
  }
);


export default router;
