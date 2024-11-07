// user.model.ts
import mongoose, { Document, Schema } from "mongoose";
import settingsModel from "./settings.model"; // Importiere das Settings-Modell

// Definiere den User-Typ
export type User = {
    name: string;
    surname?: string; // Optional, daher das Fragezeichen
    email: string;
    password: string;
    settings?: mongoose.Types.ObjectId[]; // Optional, daher das Fragezeichen
    createdAt?: Date; // Optional, damit es beim Erstellen nicht zwingend angegeben werden muss
}

// Definiere das UserDocument-Typ
export type UserDocument = User & Document;

const userSchema: Schema<UserDocument> = new Schema({
    name: { type: String, required: true },
    surname: { type: String, required: false }, // Optional
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    settings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Settings" }] // Referenz auf Settings
}, { timestamps: true });

export const UserModel = mongoose.model<UserDocument>("User", userSchema);
