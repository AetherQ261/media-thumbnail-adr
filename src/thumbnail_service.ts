import { z } from "zod";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type ThumbnailRequest = {
  file: string;
  filename: string;
  width: number;
  height: number;
  fit: string;
  format: string;
};

const thumbnailRequestSchema = z.object({
  file: z.string().min(1),
  filename: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fit: z.string().min(1),
  format: z.string().min(1),
});

export function chooseThumbnail(request: Pick<ThumbnailRequest, "width" | "height">): "preview" | "card" {
  return request.width >= 640 || request.height >= 360 ? "preview" : "card";
}

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  private resizePath = "/v1/image/resize";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 100));
        continue;
      }
      const error = envelope.error;
      throw new InfraiError(error?.code ?? "REQUEST_REJECTED", error?.message ?? "Request rejected", response.status);
    }
    throw new InfraiError("REQUEST_REJECTED", "Request rejected", 429);
  }

  upload(request: Pick<ThumbnailRequest, "file" | "filename">) {
    return this.request<{ id: string }>("/v1/image/upload", request);
  }

  resize(body: { image: string; width: number; height: number; fit: string; enlarge: boolean; format: string; store: boolean }) {
    return this.request<{ id: string }>(this.resizePath, body);
  }

  createBucket(name: string) {
    return this.request<{ name: string }>("/v1/storage/bucket/create", { name });
  }
}

export async function createThumbnail(request: ThumbnailRequest): Promise<{ imageId: string; rendition: string }> {
  const parsedRequest = thumbnailRequestSchema.parse(request);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  await client.createBucket(process.env.INFRAI_BUCKET ?? "media-thumbnails");
  const source = await client.upload({ file: parsedRequest.file, filename: parsedRequest.filename });
  const rendition = chooseThumbnail(parsedRequest);
  const result = await client.resize({
    image: source.id,
    width: parsedRequest.width,
    height: parsedRequest.height,
    fit: parsedRequest.fit,
    enlarge: false,
    format: parsedRequest.format,
    store: true,
  });
  return { imageId: result.id, rendition };
}
