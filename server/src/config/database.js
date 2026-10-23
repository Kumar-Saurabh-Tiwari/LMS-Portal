import mongoose from "mongoose";

export async function connectToDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error("MONGODB_URI must be configured.");
  }

  await mongoose.connect(uri);
}
