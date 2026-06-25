import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate MIME type — whitelist image types only
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only JPEG, PNG, WebP, GIF, and AVIF images are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum allowed size is 10 MB." },
        { status: 400 }
      );
    }

    // Convert file to base64 data URI
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString("base64");
    const dataURI = `data:${file.type};base64,${base64Data}`;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: "dcart/products",
      resource_type: "image",
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
    });
  } catch (error) {
    // Log full error server-side, never expose to client
    console.error("Error uploading to Cloudinary:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
