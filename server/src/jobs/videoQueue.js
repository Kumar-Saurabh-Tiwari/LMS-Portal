import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";

let connection;
let queue;

function getConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL must be configured to process video uploads.");
  connection ??= new IORedis(url, { maxRetriesPerRequest: null });
  return connection;
}

export function getVideoQueue() {
  queue ??= new Queue("video-transcoding", { connection: getConnection() });
  return queue;
}

export function createVideoWorker(processVideo) {
  return new Worker("video-transcoding", processVideo, {
    connection: getConnection(),
    concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 2),
  });
}

export async function closeVideoQueue() {
  await queue?.close();
  await connection?.quit();
  queue = undefined;
  connection = undefined;
}
