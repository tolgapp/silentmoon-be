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
import axios, { AxiosError } from "axios";

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

interface Video {
  id: number;
  title: string;
  url: string;
  videoUrl: string
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

// /settings - Route zum Erstellen der Einstellungen
router.post(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { time, days } = req.body;

    if (!time || !Array.isArray(days)) {
      return void res
        .status(400)
        .json({ message: "Zeit und Tage sind erforderlich." });
    }

    if (!userId) {
      return void res
        .status(400)
        .json({ message: "Benutzer-ID ist erforderlich." });
    }

    try {
      // Einstellungen direkt im User-Dokument speichern
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { time, days, hasCompletedSettings: true },
        { new: true } // Gibt das aktualisierte User-Dokument zurück
      );

      if (!updatedUser) {
        return void res
          .status(404)
          .json({ message: "Benutzer nicht gefunden." });
      }

      return void res.status(201).json({
        message: "Einstellungen erfolgreich gespeichert.",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Fehler beim Speichern der Einstellungen:", error);
      return void res
        .status(500)
        .json({ message: "Fehler beim Speichern der Einstellungen." });
    }
  }
);

router.put(
  "/settings/update",
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { time, days } = req.body;

    if (!userId) {
      return void res
        .status(400)
        .json({ message: "Benutzer-ID ist erforderlich." });
    }

    if (!time || !Array.isArray(days)) {
      return void res
        .status(400)
        .json({ message: "Zeit und Tage sind erforderlich." });
    }

    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { time, days },
        { new: true }
      );

      if (!updatedUser) {
        return void res
          .status(404)
          .json({ message: "Benutzer nicht gefunden." });
      }

      return void res.status(200).json({
        message: "Einstellungen erfolgreich aktualisiert.",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Einstellungen:", error);
      return void res
        .status(500)
        .json({ message: "Fehler beim Aktualisieren der Einstellungen." });
    }
  }
);

router.get(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      return void res
        .status(400)
        .json({ message: "Benutzer-ID ist erforderlich." });
    }

    try {
      const user = await User.findById(userId).select(
        "time days hasCompletedSettings"
      );

      if (!user) {
        return void res
          .status(404)
          .json({ message: "Benutzer nicht gefunden." });
      }

      return void res.status(200).json({
        time: user.time,
        days: user.days,
        hasCompletedSettings: user.hasCompletedSettings,
      });
    } catch (error) {
      console.error("Fehler beim Abrufen der Einstellungen:", error);
      return void res
        .status(500)
        .json({ message: "Fehler beim Abrufen der Einstellungen." });
    }
  }
);

// Home
router.get("/home", verifyToken, (req: Request, res: Response) => {
  const homeData = {
    message: "Welcome to the home page!",
  };

  res.status(200).json(homeData);
});

// Spotify Auth & Playlists
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

router.post("/spotifytoken", async (req: Request, res: Response) => {
  const { code, pathname }: { code: string; pathname?: string } = req.body;

  if (!code) {
    return void res.status(400).json({ error: "Code fehlt in der Anfrage." });
  }

  let redirectUri: string | undefined;

  if (pathname === "/music") {
    redirectUri = process.env.MUSIC;
  } else if (pathname === "/meditation") {
    redirectUri = process.env.SPOTIFY_REDIRECT_URI_MEDI;
  }

  if (!redirectUri || typeof redirectUri !== "string") {
    return void res
      .status(500)
      .json({ error: "Redirect URI is not configured correctly." });
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: SPOTIFY_CLIENT_ID || "",
        client_secret: SPOTIFY_CLIENT_SECRET || "",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = response.data;
    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error("Fehler bei der Spotify-Token-Anfrage:", error);
    res.status(500).json({ error: "Spotify-Token-Anfrage fehlgeschlagen." });
  }
});

router.get(
  "/spotify/playlists",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return void res.status(400).json({ error: "Access Token is required" });
    }

    const query = req.query.q || "meditation";

    try {
      const response = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          q: query,
          type: "playlist",
          limit: 20,
        },
      });

      const spotifyPlaylists = response.data.playlists.items.filter(
        (playlist: any) => playlist.owner.id === "spotify"
      );

      return void res.status(200).json({ playlists: spotifyPlaylists });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Spotify API error:",
          error.response?.data || error.message
        );
        return void res
          .status(500)
          .json({ error: "Failed to fetch playlists" });
      } else {
        console.error("Unexpected error:", error);
        return void res
          .status(500)
          .json({ error: "Unexpected error occurred" });
      }
    }
  }
);

router.get("/spotify/playlists/:playlistId/tracks", async (req, res) => {
  const playlistId = req.params.playlistId;
  const accessToken = req.headers.authorization?.split(" ")[1];
  if (!accessToken) {
    return void res.status(400).send("Access token is missing");
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;

    console.error("Error fetching tracks from Spotify:", axiosError);

    if (axiosError.response) {
      console.error("Spotify API response error:", axiosError.response.data);
      return void res.status(500).send(axiosError.response.data);
    } else if (axiosError.request) {
      console.error("No response received from Spotify:", axiosError.request);
      return void res.status(500).send("No response from Spotify API");
    } else {
      console.error("Error during request setup:", axiosError.message);
      return void res.status(500).send("Error fetching data from Spotify");
    }
  }
});

// ** Favorites Routes


router.get("/favoritevideos", async (req: Request, res: Response): Promise<void> => {
  const { userId, contentId } = req.query as { userId: string; contentId: string };

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/) || !contentId) {
    return void res.status(400).json({ message: "userId and contentId are required" });
  }

  const cleanedContentId = contentId.replace(/^https?:\/\/[^/]+/, "");

  try {
    const user = await User.findById(userId);
    if (!user) {
      return void res.status(404).json({ message: "User not found" });
    }

    // Check if the video is in the user's favorites
    const isFavorite = user.videoFavorites?.some((fav) => fav.contentId === cleanedContentId);

    // Send response based on whether the video is in the favorites
    return void res.status(200).json({ isFavorite: !!isFavorite });
  } catch (error) {
    console.error("Error in /favoritevideos:", error);
    return void res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : error });
  }
});


router.get("/favorites", verifyToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return void res.status(400).json({ message: "Benutzer-ID ist erforderlich" });
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.videoFavorites) {
      return void res.status(404).json({ message: "Favoriten nicht gefunden" });
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
    return void res.status(500).json({ message: "Fehler beim Abrufen der Favoriten" });
  }
});



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
      return void res.status(400).json({ message: "Invalid or missing userId" });
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


router.post("/favorites/audio/add", async (req, res) => {
  const { userId, contentId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return void res.status(404).json({ message: "User not found" });
    }

    const exists = user.audioFavorites?.some(
      (fav) => fav.contentId === contentId
    );
    if (exists) {
      return void res
        .status(400)
        .json({ message: "Audio already in favorites" });
    }

    user.audioFavorites?.push({ contentId, addedAt: new Date() });
    await user.save();
    res.status(200).json({ message: "Audio added to favorites" });
  } catch (error) {
    res.status(500).json({ message: "Error adding audio to favorites", error });
  }
});

router.post("/favorites/audio/remove", async (req, res) => {
  const { userId, contentId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return void res.status(404).json({ message: "User not found" });
    }

    user.audioFavorites = user.audioFavorites?.filter(
      (fav) => fav.contentId !== contentId
    );

    await user.save();
    res.status(200).json({ message: "Audio removed from favorites" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error removing audio from favorites", error });
  }
});



export default router;
