import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel as User } from "../models/user.model";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  res.status(201).send("Welcome to Silentmoon!");
});

router.post("/signup", async (req: Request, res: Response): Promise<void> => {
  const { name, surname, email, password } = req.body;

  // Message if one of the fields are not filled
  if (!name || !surname || !email || !password) {
    return void res.status(400).send("Each input field must be filled out.");
  }

  // Checking for existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return void res.status(409).send("Choose another email.");
  }

  try {
    // Hashing the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creating and saving the user
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

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return void res.status(400).send("Email and password are required");
  }

  try {
    // Find user in database
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      return void res.status(401).send("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return void res.status(401).send("Invalid email or password");
    }

    return void res.status(200).json({
      message: "Login successful",
    });
  } catch (error) {
    console.error(error);
    return void res.status(500).send("Login error");
  }
});

router.get("/yoga", (req: Request, res: Response) => {
  const yogaVideos = [
    { id: 1, title: "Yoga for starter", url: "http://example.com/yoga1" },
    { id: 2, title: "Advanced Yoga", url: "http://example.com/yoga2" },
  ];

  res.status(200).json(yogaVideos);
});

router.get("/meditation", (req: Request, res: Response) => {
  const meditationVideos = [
    { id: 1, title: "Medi for starter", url: "http://example.com/meditation1" },
    {
      id: 2,
      title: "Advanced Meditation",
      url: "http://example.com/meditation2",
    },
  ];

  res.status(200).json(meditationVideos);
});

export default router;
