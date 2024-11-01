import mongoose, { Document, Schema } from "mongoose";

type YogaVideoType = {
  title: string;
  url: string;
};

const YogaVideoSchema: Schema = new Schema({
    title: { type: String, required: true},
    url: { type: String, required: true}
})

const YogaVideo = mongoose.model<YogaVideoType>("YogaVideo", YogaVideoSchema)

export {YogaVideo, YogaVideoType}