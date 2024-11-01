import mongoose, { Document, Schema } from "mongoose";

export type User = {
    name: string;
    surname: string;
    email: string;
    password: string;
    createdAt: Date;
}

export type UserDocument = User & Document;

const userSchema: Schema<UserDocument> = new Schema({
    name: { type: String, required: true },
    surname: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, unique: true },
}, { timestamps: true });

export const UserModel = mongoose.model<UserDocument>("User", userSchema);
