import mongoose, { Schema, Document } from "mongoose";

interface YogaVideo extends Document {
  title: string;
  url: string;
  image: string;
  level: string;
  time: string;
  description: string;
}

const YogaVideoSchema: Schema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  image: { type: String, required: true },
  level: { type: String, required: true },
  time: { type: String, required: true },
  description: { type: String, required: true },
});

const YogaVideoModel = mongoose.model<YogaVideo>("YogaVideo", YogaVideoSchema);

export default YogaVideoModel;
