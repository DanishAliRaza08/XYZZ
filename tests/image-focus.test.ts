import { describe, expect, it } from "vitest";
import { focusStyle, parseImage, withFocus } from "@/lib/image-focus";
import { heroTextPosition } from "@/lib/hero";

describe("picture framing (Adjust)", () => {
  it("reads and writes the framing on the picture address", () => {
    expect(parseImage("/uploads/a.jpg")).toEqual({ src: "/uploads/a.jpg", x: 50, y: 50, zoom: 1 });
    expect(parseImage("/uploads/a.jpg#fp=20,75.5,1.4")).toEqual({ src: "/uploads/a.jpg", x: 20, y: 75.5, zoom: 1.4 });
    expect(withFocus({ src: "/uploads/a.jpg", x: 20, y: 75.54, zoom: 1.4 })).toBe("/uploads/a.jpg#fp=20,75.5,1.4");
    expect(withFocus({ src: "https://cdn.example/a.jpg", x: 50, y: 50, zoom: 1 })).toBe("https://cdn.example/a.jpg"); // centred = plain address
  });
  it("keeps values in range and ignores anything else after #", () => {
    expect(parseImage("/a.jpg#fp=-20,180,9")).toEqual({ src: "/a.jpg", x: 0, y: 100, zoom: 3 });
    expect(parseImage("/a.jpg#section")).toEqual({ src: "/a.jpg", x: 50, y: 50, zoom: 1 });
  });
  it("turns framing into CSS", () => {
    expect(focusStyle(parseImage("/a.jpg#fp=10,90,1"))).toEqual({ objectPosition: "10% 90%" });
    expect(focusStyle(parseImage("/a.jpg#fp=10,90,2"))).toEqual({ objectPosition: "10% 90%", transform: "scale(2)", transformOrigin: "10% 90%" });
  });
  it("banner text position falls back to left", () => {
    expect(heroTextPosition("hidden")).toBe("hidden");
    expect(heroTextPosition("diagonal")).toBe("left");
    expect(heroTextPosition(null)).toBe("left");
  });
});
