import { model, Schema, Document } from "mongoose";

interface Image extends Document {
  title: string;
  level: string;
  category: string;
  description: string;
}

const imageSchema: Schema<Image> = new Schema({
  title: { type: String, required: true },
  level: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
});

export const Image = model<Image>("Image", imageSchema);
