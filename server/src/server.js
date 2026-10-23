import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectToDatabase } from "./config/database.js";
import { createVideoWorker, closeVideoQueue } from "./jobs/videoQueue.js";
import { processVideo } from "./jobs/processVideo.js";

const port = Number(process.env.PORT ?? 5000);

try {
  await connectToDatabase();
  console.info("Connected to MongoDB successfully.");
  const worker = process.env.REDIS_URL ? createVideoWorker(processVideo) : null;
  worker?.on("failed", (job, error) => console.error(`Video job ${job?.id ?? "unknown"} failed:`, error));
  worker?.on("error", (error) => console.error("Video worker error:", error));
  const server = app.listen(port, () => {
    console.log(`LMS API server listening on port ${port}.`);
  });
  const shutdown = async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await worker?.close();
    await closeVideoQueue();
    await mongoose.disconnect();
    process.exitCode = 0;
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error("Failed to start the LMS API server:", error);
  process.exitCode = 1;
}
