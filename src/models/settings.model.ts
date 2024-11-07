import mongoose, { Document, Schema } from "mongoose";

interface ISettings extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  time: string;
  days: number[];
}

const settingsSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  time: { type: String, default: "" },
  days: { type: [Number], default: [] }, 
});

const Settings = mongoose.model<ISettings>("Settings", settingsSchema);
export default Settings;
