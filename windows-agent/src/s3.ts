import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "./config";

/**
 * Upload a file to DigitalOcean Spaces (S3-compatible).
 * Uses raw HTTP with AWS Signature V4 — no SDK dependency needed.
 */
export async function uploadToSpaces(filePath: string, key: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const host = `${config.spacesBucket}.${config.spacesRegion}.digitaloceanspaces.com`;
  const url = `https://${host}/${key}`;

  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const region = config.spacesRegion;
  const service = "s3";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const payloadHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${key}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  function hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data).digest();
  }

  const kDate = hmacSha256(`AWS4${config.spacesSecret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.spacesKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spaces upload failed (${res.status}): ${text}`);
  }

  // Return CDN URL
  return `https://${config.spacesBucket}.${config.spacesRegion}.cdn.digitaloceanspaces.com/${key}`;
}
