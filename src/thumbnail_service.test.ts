import { chooseThumbnail } from "./thumbnail_service.ts";

const checks: Array<[string, "preview" | "card"]> = [
  [chooseThumbnail({ width: 1280, height: 720 }), "preview"],
  [chooseThumbnail({ width: 320, height: 180 }), "card"],
];

for (const [actual, expected] of checks) {
  if (actual !== expected) throw new Error(`expected ${expected}, received ${actual}`);
}
console.log("thumbnail decision checks passed");
