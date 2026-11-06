import { describe, expect, it } from "vitest";
import { browserImageUrl } from "./browser-image-url";

describe("browserImageUrl", () => {
  const base = "https://api.example.test/circle/avatars/user/photo";

  it.each(["heic", "HEIC", "heif", "HEIF"])("serves public %s originals through COS JPEG conversion", (ext) => {
    expect(browserImageUrl(`${base}.${ext}`)).toBe(`${base}.${ext}?imageMogr2/format/jpg`);
  });

  it.each([
    `${base}.jpg`,
    `${base}.png`,
    `${base}.heic?X-Amz-Signature=signature`,
    "https://api.example.test/circle/chat/user/photo.heic",
    "https://api.example.test/circle/notes/user/photo.heic",
    null,
    undefined,
  ])("preserves ordinary images and signed/private URLs: %s", (url) => {
    expect(browserImageUrl(url)).toBe(url);
  });
});
