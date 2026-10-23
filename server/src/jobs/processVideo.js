import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { downloadMedia, putMedia } from "../config/mediaStorage.js";
import { Lesson } from "../models/Lesson.js";

const execute = promisify(execFile);
const contentTypes = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

export async function processVideo({ data: { lessonId, sourceKey } }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} no longer exists.`);
  lesson.video.processingStatus = "processing";
  lesson.video.processingError = undefined;
  await lesson.save();

  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "lms-transcode-"));
  try {
    const inputPath = path.join(workingDirectory, "source-video");
    const outputDirectory = path.join(workingDirectory, "hls");
    await downloadMedia(sourceKey, inputPath);
    await mkdir(outputDirectory);
    const playlistPath = path.join(outputDirectory, "stream.m3u8");
    await execute(process.env.FFMPEG_PATH ?? "ffmpeg", [
      "-nostdin", "-y", "-i", inputPath,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-vf", "scale=-2:720:force_original_aspect_ratio=decrease",
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
      "-c:a", "aac", "-b:a", "128k",
      "-hls_time", "6", "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(outputDirectory, "segment-%05d.ts"),
      playlistPath,
    ], { timeout: Number(process.env.FFMPEG_TIMEOUT_MS ?? 3_600_000), maxBuffer: 10 * 1024 * 1024 });

    await writeFile(path.join(outputDirectory, "master.m3u8"), [
      "#EXTM3U",
      "#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720",
      "stream.m3u8",
      "",
    ].join("\n"));

    const outputKeys = [];
    for (const fileName of await readdir(outputDirectory)) {
      const filePath = path.join(outputDirectory, fileName);
      const extension = path.extname(fileName);
      const key = `hls/${lessonId}/${fileName}`;
      await putMedia(key, createReadStream(filePath), contentTypes[extension] ?? "application/octet-stream");
      outputKeys.push(key);
    }

    lesson.video.hlsMasterKey = `hls/${lessonId}/master.m3u8`;
    lesson.video.processingStatus = "ready";
    lesson.video.processingError = undefined;
    const metadata = await readFile(path.join(outputDirectory, "stream.m3u8"), "utf8");
    const segmentDurations = [...metadata.matchAll(/#EXTINF:([\d.]+)/g)].map((match) => Number(match[1]));
    if (segmentDurations.length) lesson.durationSeconds = Math.round(segmentDurations.reduce((sum, value) => sum + value, 0));
    await lesson.save();
    return { lessonId, files: outputKeys.length };
  } catch (error) {
    await Lesson.findByIdAndUpdate(lessonId, {
      "video.processingStatus": "failed",
      "video.processingError": error.message.slice(0, 500),
    });
    throw error;
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
