import { Request, Response } from "express";
import { UserModel as User } from "../models/user.model";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AuthRequest } from "../routes/routing";

dotenv.config();
const secretKey = process.env.JWT_SECRET;

if (!secretKey) {
  throw new Error('JWT_SECRET is not defined!');
}

export const signup = async (req: Request, res: Response): Promise<void> => {
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
}

export const login = async (req: Request, res: Response): Promise<void> => {
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
}

export const logout = (req: Request, res: Response) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: "/",
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Internal error during logout" });
  }
}

export const protectedRoutes = 
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