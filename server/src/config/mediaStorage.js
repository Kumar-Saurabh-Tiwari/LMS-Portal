import { createWriteStream } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const mediaDirectory = path.resolve(process.env.MEDIA_DIR ?? path.join(serverDirectory, "media"));
const bucket = process.env.AWS_S3_BUCKET;
const cloudFrontBaseUrl = process.env.CLOUDFRONT_URL?.replace(/\/+$/, "");
const s3 = bucket
  ? new S3Client({
      region: process.env.AWS_REGION,
      ...(process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL } : {}),
    })
  : null;

function resolveLocalPath(key) {
  const resolved = path.resolve(mediaDirectory, key);
  if (!resolved.startsWith(`${mediaDirectory}${path.sep}`)) throw new Error("Invalid media object key.");
  return resolved;
}

export async function putMedia(key, source, contentType) {
  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: source,
      ContentType: contentType,
      ...(key.endsWith(".m3u8") ? { CacheControl: "public, max-age=60" } : {}),
      ...(key.endsWith(".ts") ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
    }));
    return;
  }
  const destination = resolveLocalPath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  if (Buffer.isBuffer(source) || typeof source === "string") {
    await writeFile(destination, source);
  } else {
    await pipeline(source, createWriteStream(destination));
  }
}

export async function downloadMedia(key, destination) {
  if (s3) {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    await pipeline(result.Body, createWriteStream(destination));
    return;
  }
  await copyFile(resolveLocalPath(key), destination);
}

export function mediaUrl(key) {
  return s3 ? `${cloudFrontBaseUrl}/${key}` : `/media/${key}`;
}

export function isCloudStorageConfigured() {
  return Boolean(s3 && cloudFrontBaseUrl);
}
