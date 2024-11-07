import mongoose, { Schema } from "mongoose";

type VideoType = {
  title: string;
  url: string;
};

const VideoSchema: Schema = new Schema({
    title: { type: String, required: true},
    url: { type: String, required: true}
})

const Video = mongoose.model<VideoType>("YogaVideo", VideoSchema)

export {Video, VideoType}