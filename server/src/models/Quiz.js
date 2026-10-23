import mongoose from "mongoose";

const { Schema, model } = mongoose;

const questionSchema = new Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 2000 },
    options: {
      type: [{ type: String, required: true, trim: true, maxlength: 500 }],
      validate: {
        validator: (options) => options.length >= 2,
        message: "Each quiz question needs at least two answer options.",
      },
    },
    correctOption: { type: Number, required: true, min: 0 },
    explanation: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: true }
);

questionSchema.path("correctOption").validate(function (value) {
  return Number.isInteger(value) && value < this.options.length;
}, "Correct option must refer to an available answer.");

const quizSchema = new Schema(
  {
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    passingScore: { type: Number, min: 0, max: 100, default: 70 },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (questions) => questions.length > 0,
        message: "A quiz must contain at least one question.",
      },
    },
  },
  { timestamps: true }
);

export const Quiz = model("Quiz", quizSchema);
