import { createThumbnail } from "./thumbnail_service.ts";

const result = await createThumbnail({
  file: process.env.MEDIA_IMAGE_BASE64 ?? "base64-image-data",
  filename: "creator-upload.jpg",
  width: 640,
  height: 360,
  fit: "cover",
  format: "webp",
});
console.log(JSON.stringify(result, null, 2));
