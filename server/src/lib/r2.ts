import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

// Cloudflare R2 is S3-compatible. The endpoint format is:
// https://<ACCOUNT_ID>.r2.cloudflarestorage.com
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  forcePathStyle: true, // This is important for Cloudflare R2
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns the public URL of the uploaded object.
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,          // e.g. "papers/2023-econ201-semester1.pdf"
  contentType: string   // e.g. "application/pdf"
): Promise<string> {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: Readable.from(buffer),
      ContentType: contentType,
    },
  });

  await upload.done();

  // Public URL via the custom domain (or R2.dev subdomain if no custom domain)
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!.replace(/\/$/, '');
  return `${publicBaseUrl}/${key}`;
}

/**
 * Delete an object from Cloudflare R2 by its key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  );
}

/**
 * Extract the R2 object key from a full public URL.
 * e.g. "https://pub.example.com/papers/foo.pdf" → "papers/foo.pdf"
 */
export function keyFromUrl(url: string): string {
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!.replace(/\/$/, '');
  return url.replace(`${publicBaseUrl}/`, '');
}
