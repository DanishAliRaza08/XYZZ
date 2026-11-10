// Admin → Customer chats → "Test the assistant": Google's errors explained in plain words.
import { afterEach, describe, expect, it, vi } from "vitest";
import { explainGeminiError, testAssistant } from "@/lib/chat";

describe("explainGeminiError", () => {
  it("names the fix for the usual problems", () => {
    expect(explainGeminiError(400, "API key not valid. Please pass a valid API key.")).toMatch(/isn't valid.*aistudio\.google\.com\/apikey/);
    expect(explainGeminiError(400, "User location is not supported for the API use.")).toMatch(/server's location/);
    expect(explainGeminiError(403, "Generative Language API has not been used in project 123 before or it is disabled.")).toMatch(/Make a new key at aistudio/);
    expect(explainGeminiError(404, "models/gemini-x is not found for API version v1beta")).toMatch(/GEMINI_MODEL = gemini-2\.5-flash/);
    expect(explainGeminiError(429, "Resource has been exhausted (e.g. check quota).")).toMatch(/free daily\/per-minute allowance/);
    expect(explainGeminiError(500, "Internal error")).toBe("Google answered 500: Internal error");
  });
});

describe("testAssistant", () => {
  const key = process.env.GEMINI_API_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  });

  it("explains a missing key, a refused key and a working one", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await testAssistant()).toEqual({ ok: false, message: expect.stringMatching(/GEMINI_API_KEY isn't set/) });

    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "API key not valid." } }, { status: 400 }));
    expect(await testAssistant()).toEqual({ ok: false, message: expect.stringMatching(/isn't valid/) });

    vi.stubGlobal("fetch", async () => Response.json({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }));
    expect(await testAssistant()).toEqual({ ok: true, message: expect.stringMatching(/The assistant works/) });

    vi.stubGlobal("fetch", async () => { throw new TypeError("fetch failed"); });
    expect((await testAssistant()).message).toMatch(/Couldn't reach Google/);
  });
});
