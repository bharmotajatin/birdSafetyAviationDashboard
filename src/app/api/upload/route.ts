import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuthedUser } from "@/app/api/incidents/helpers";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function uploadBuffer(buffer: Buffer, folder: string, resourceType: "image" | "raw") {
  return new Promise<{ secure_url: string; public_id: string; bytes: number }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve(result as { secure_url: string; public_id: string; bytes: number });
      },
    );
    stream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: "Cloudinary credentials are missing." }, { status: 500 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files");
  const captionsRaw = formData.get("captions");
  const captions: string[] = captionsRaw ? JSON.parse(String(captionsRaw)) : [];

  if (!files.length) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  const uploads = [];
  for (let index = 0; index < files.length; index += 1) {
    const entry = files[index];
    if (!(entry instanceof File)) continue;
    if (!ALLOWED_TYPES.includes(entry.type)) {
      return NextResponse.json({ error: `Unsupported type for ${entry.name}` }, { status: 400 });
    }
    if (entry.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${entry.name}` }, { status: 400 });
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    const resourceType = entry.type === "application/pdf" ? "raw" : "image";
    const uploaded = await uploadBuffer(buffer, "bfs/incidents", resourceType);
    uploads.push({
      filename: uploaded.public_id,
      originalName: entry.name,
      url: uploaded.secure_url,
      mimeType: entry.type,
      sizeBytes: uploaded.bytes,
      caption: captions[index] ?? "",
    });
  }

  return NextResponse.json({ files: uploads });
}
