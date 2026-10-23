import mongoose from "mongoose";

const { Schema, model } = mongoose;

const lessonSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Lesson position must be an integer.",
      },
    },
    type: {
      type: String,
      enum: ["video", "live", "quiz", "text"],
      required: true,
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    durationSeconds: {
      type: Number,
      min: 0,
    },
    video: {
      sourceKey: String,
      hlsMasterKey: String,
      processingStatus: {
        type: String,
        enum: ["not_uploaded", "queued", "processing", "ready", "failed"],
        default: "not_uploaded",
      },
      processingError: String,
    },
    liveClass: {
      startsAt: Date,
      endsAt: Date,
      liveKitRoomName: String,
      status: {
        type: String,
        enum: ["scheduled", "live", "ended", "cancelled"],
      },
    },
    quiz: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
    },
    textContent: {
      type: String,
      maxlength: 50000,
    },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, position: 1 }, { unique: true });

export const Lesson = model("Lesson", lessonSchema);
