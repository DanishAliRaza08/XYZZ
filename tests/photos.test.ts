import { describe, expect, it } from "vitest";
import { photoForColour, photosForColour } from "@/lib/photos";

const img = (url: string, colour: string | null) => ({ url, colour });
const photos = [img("all-1", null), img("black-1", "Black"), img("white-1", "White"), img("white-2", "White"), img("all-2", null)];

describe("colour photos", () => {
  it("puts the chosen colour's photos first, then shared photos, and hides other colours", () => {
    expect(photosForColour(photos, "White").map((p) => p.url)).toEqual(["white-1", "white-2", "all-1", "all-2"]);
    expect(photosForColour(photos, "Black").map((p) => p.url)).toEqual(["black-1", "all-1", "all-2"]);
  });
  it("shows only shared photos for a colour without its own", () => {
    expect(photosForColour(photos, "Pink").map((p) => p.url)).toEqual(["all-1", "all-2"]);
  });
  it("never ends up empty", () => {
    const tagged = [img("black-1", "Black")];
    expect(photosForColour(tagged, "White")).toEqual(tagged);
    expect(photosForColour([], "White")).toEqual([]);
  });
  it("picks the best single photo for the bag", () => {
    expect(photoForColour(photos, "White")?.url).toBe("white-1");
    expect(photoForColour(photos, "Pink")?.url).toBe("all-1");
    expect(photoForColour([img("black-1", "Black")], "White")?.url).toBe("black-1");
    expect(photoForColour([], "White")).toBeUndefined();
  });
});
