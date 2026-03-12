import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { requireAdmin } from "@/backend/lib/middleware/admin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml"
]);

const isCloudinaryConfigured = () => {
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasKeys = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
  return hasUrl || hasKeys;
};

const configureCloudinary = () => {
  if (process.env.CLOUDINARY_URL) {
    try {
      const parsed = new URL(process.env.CLOUDINARY_URL);
      cloudinary.config({
        cloud_name: parsed.hostname,
        api_key: parsed.username,
        api_secret: parsed.password,
        secure: true
      });
    } catch (error) {
      console.error("Invalid CLOUDINARY_URL:", error);
    }
    return;
  }
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
};

const extensionFromMime = (mimeType: string) => {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
};

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Logo file is required." }, { status: 400 });
    }

    const uploadFile = file as File;
    if (!ALLOWED_MIME_TYPES.has(uploadFile.type)) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
    }
    if (uploadFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Logo must be under 2MB." }, { status: 413 });
    }

    const bytes = await uploadFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isCloudinaryConfigured()) {
      configureCloudinary();
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "bundlearena/brand",
            resource_type: "image",
            overwrite: true
          },
          (error, response) => {
            if (error || !response) {
              reject(error ?? new Error("Cloudinary upload failed."));
              return;
            }
            resolve(response as { secure_url: string });
          }
        );
        Readable.from(buffer).pipe(uploadStream);
      });

      return NextResponse.json({ url: result.secure_url });
    }

    const isVercel = process.env.VERCEL === "1";
    if (isVercel) {
      return NextResponse.json(
        {
          error:
            "File upload requires Cloudinary. Use the “Or use a logo URL” field below and paste a direct image link instead (no Cloudinary needed)."
        },
        { status: 503 }
      );
    }

    const extension = extensionFromMime(uploadFile.type);
    const fileName = `brand-${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "brand");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), buffer);

    return NextResponse.json({ url: `/uploads/brand/${fileName}` });
  } catch (error) {
    console.error("Brand logo upload error:", error);
    return NextResponse.json({ error: "Unable to upload logo." }, { status: 500 });
  }
}
