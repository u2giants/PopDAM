import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "./config";
import { recordUpload } from "./transferStats";

/**
 * Upload a file to DigitalOcean Spaces (S3-compatible).
 * Uses raw HTTP with AWS Signature V4 — no SDK needed.
 */
export async function uploadToSpaces(
  filePath: string,
  key: string,
  contentType = "image/jpeg"
): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const region = config.spacesRegion;
  const bucket = config.spacesBucket;
  const host = `${bucket}.${region}.digitaloceanspaces.com`;
  const endpoint = `https://${host}`;

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const method = "PUT";
  const canonicalUri = `/${key}`;
  const canonicalQuerystring = "";

  const payloadHash = sha256(fileBuffer);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(Buffer.from(canonicalRequest)),
  ].join("\n");

  const signingKey = getSignatureKey(config.spacesSecret, dateStamp, region, "s3");
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${config.spacesKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${endpoint}${canonicalUri}`, {
    method,
    headers: {
      "Content-Type": contentType,
      Host: host,
      "x-amz-acl": "public-read",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorizationHeader,
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`S3 upload failed (${res.status}): ${body}`);
  }

  // Track transfer stats
  recordUpload(fileBuffer.length);

  // Return the CDN URL
  return `${endpoint}/${key}`;
}

function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  return kSigning;
}
