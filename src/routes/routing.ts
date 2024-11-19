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
import Settings from "../models/settings.model";
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
      },
    });
  } catch (error) {
    console.error(error);
    return void res.status(500).send("Login error");
  }
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.status(200).json({ message: "Logout successful" });
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

router.post(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { time, days } = req.body;

    if (!time || !Array.isArray(days)) {
      res.status(400).json({ message: "Zeit und Tage sind erforderlich." });
      return;
    }

    if (!userId) {
      res.status(400).json({ message: "Benutzer-ID ist erforderlich." });
      return;
    }

    try {
      const updatedSettings = await Settings.findOneAndUpdate(
        { userId },
        { time, days },
        { new: true, upsert: true }
      );

      res.status(201).json(updatedSettings);
    } catch (error) {
      console.error("Fehler beim Speichern der Einstellungen:", error);
      res
        .status(500)
        .json({ message: "Fehler beim Speichern der Einstellungen." });
    }
  }
);

router.put(
  "/settings/update",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { time, days } = req.body;

    if (!userId) {
      res.status(400).json({ message: "Benutzer-ID ist erforderlich." });
      return;
    }

    if (!time || !Array.isArray(days)) {
      res.status(400).json({ message: "Zeit und Tage sind erforderlich." });
      return;
    }

    try {
      const updatedSettings = await Settings.findOneAndUpdate(
        { userId },
        { time, days },
        { new: true, upsert: true }
      );

      res.status(200).json(updatedSettings);
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Einstellungen:", error);
      res
        .status(500)
        .json({ message: "Fehler beim Aktualisieren der Einstellungen." });
    }
  }
);


router.get(
  "/settings",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return void res
        .status(400)
        .json({ message: "Benutzer-ID ist erforderlich." });
    }

    try {
      const settings = await Settings.findOne({ userId });

      if (!settings) {
        return void res
          .status(404)
          .json({ message: "Einstellungen nicht gefunden." });
      }

      res.status(200).json({ settings });
    } catch (error) {
      console.error("Fehler beim Abrufen der Einstellungen:", error);
      res
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
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

router.post("/spotifytoken", async (req: Request, res: Response) => {
  const { code }: { code: string } = req.body;
  console.log("Received authorization code:", code); 

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
    return void res
      .status(400)
      .json({ error: "Spotify credentials are missing" });
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code, 
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = response.data;
    console.log("Access token received:", access_token); 

    return void res.json({ access_token, refresh_token });
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.error("Spotify Token API error response:", axiosError.response.data);
      return void res.status(500).json({ error: axiosError.response.data });
    } else if (axiosError.request) {
      console.error(
        "No response received from Spotify API:",
        axiosError.request
      );
      return void res
        .status(500)
        .json({ error: "No response from Spotify API" });
    } else {
      console.error("Error during request setup:", axiosError.message);
      return void res.status(500).json({ error: axiosError.message });
    }
  }
});


router.get(
  "/spotify/playlists",
  verifyToken, 
  async (req: AuthRequest, res: Response) => {
    const { accessToken } = req.query;

    if (!accessToken) {
      return void res.status(400).json({ error: "Access Token is required" });
    }

    try {
      const response = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          q: "meditation",
          type: "playlist",
          limit:20, 
        },
      });

      const spotifyPlaylists = response.data.playlists.items.filter(
        (playlist: any) => playlist.owner.id === "spotify"
      );


      return void res.status(200).json({ playlists: spotifyPlaylists });
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(
          "Spotify API Playlists error response:",
          axiosError.response.data
        );
        return void res.status(500).json({ error: axiosError.response.data });
      } else if (axiosError.request) {
        console.error(
          "No response received from Spotify API:",
          axiosError.request
        );
        return void res
          .status(500)
          .json({ error: "No response received from Spotify API" });
      } else {
        console.error("Error during request setup:", axiosError.message);
        return void res.status(500).json({ error: axiosError.message });
      }
    }
  }
);


router.get('/spotify/playlists/:playlistId/tracks', async (req, res) => {
  console.log(req)
  const playlistId = req.params.playlistId;
  const accessToken = req.headers.authorization?.split(' ')[1];
console.log(accessToken)
  if (!accessToken) {
    return void res.status(400).send('Access token is missing');
  }

  try {
    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    res.json(response.data); 
  } catch (error) {
    // Typisierung des Fehlerobjekts als AxiosError
    const axiosError = error as AxiosError;

    console.error('Error fetching tracks from Spotify:', axiosError);

    if (axiosError.response) {
      console.error("Spotify API response error:", axiosError.response.data);
      return void res.status(500).send(axiosError.response.data); // Detaillierte Fehlerantwort von Spotify zurückgeben
    } else if (axiosError.request) {
      console.error("No response received from Spotify:", axiosError.request);
      return void res.status(500).send('No response from Spotify API');
    } else {
      console.error("Error during request setup:", axiosError.message);
      return void res.status(500).send('Error fetching data from Spotify');
    }
  }
});


export default router;
