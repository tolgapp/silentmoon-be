import mongoose, { Document, Schema } from "mongoose";

export type FavoriteItem = {
  contentId: string; 
  addedAt: Date;     
};

export type User = {
  name: string;
  surname?: string;
  email: string;
  password: string;
  image? : string;
  time?: string;
  days?: number[];
  hasCompletedSettings?: boolean;
  createdAt?: Date;
  audioFavorites?: FavoriteItem[]; 
  videoFavorites?: FavoriteItem[];
};

const favoriteItemSchema: Schema = new Schema(
  {
    contentId: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false } 
);

const userSchema: Schema<UserDocument> = new Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    image: { type: String },
    password: { type: String, required: true },
    time: { type: String, default: "" },
    days: { type: [Number], default: [] },
    hasCompletedSettings: { type: Boolean, default: false },
    audioFavorites: { type: [favoriteItemSchema], default: [] }, 
    videoFavorites: { type: [favoriteItemSchema], default: [] }, 
  },
  { timestamps: true }
);

export type UserDocument = User & Document;
export const UserModel = mongoose.model<UserDocument>("User", userSchema);
