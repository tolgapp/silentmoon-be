import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { UserModel as User } from "../models/user.model";
import Settings from "../models/settings.model";

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
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    req.user = {id: decoded.id}; 
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

// Protected Routes
router.get("/protected", verifyToken, (req, res) => {
  res.status(200).send("You are authenticated");
});

router.get("/yoga", verifyToken, (req: Request, res: Response) => {
  const yogaVideos: Video[] = [
    { id: 1, title: "Yoga for starter", url: "http://example.com/yoga1" },
    { id: 2, title: "Advanced Yoga", url: "http://example.com/yoga2" },
  ];

  res.status(200).json(yogaVideos);
});

router.get("/meditation", verifyToken, (req: Request, res: Response) => {
  const meditationVideos: Video[] = [
    { id: 1, title: "Medi for starter", url: "http://example.com/meditation1" },
    {
      id: 2,
      title: "Advanced Meditation",
      url: "http://example.com/meditation2",
    },
  ];
  res.status(200).json(meditationVideos);
});

// Die Settings-Route im Backend
router.post("/settings", verifyToken, async (req: AuthRequest, res: Response) => {
  const { time, days } = req.body;  // Vom Frontend gesendete Daten

  // Überprüfen, ob die erforderlichen Felder vorhanden sind
  if (!time || !Array.isArray(days)) {
     res.status(400).json({ message: "Time and days are required." });
    return;

  }

  const userId = req.user?.id;  // userId aus dem JWT-Token, das in verifyToken gesetzt wurde

  // Wenn keine userId vorhanden ist (z.B. wenn das Token ungültig ist)
  if (!userId) {
     res.status(400).json({ message: "User ID is required." });
    return;

  }

  // Kombiniere die vom Frontend gesendeten Daten mit der userId aus dem JWT
  try {
    const newSetting = new Settings({
      time,
      days,
      userId  // Die userId direkt vom request.user
    });

    const savedSetting = await newSetting.save();  // Speichern der neuen Einstellung in der Datenbank
    res.status(201).json(savedSetting);  // Erfolgreiche Antwort mit den gespeicherten Daten
    return;
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ message: "Error saving settings.", error });
    return;
  }
});


export default router;
