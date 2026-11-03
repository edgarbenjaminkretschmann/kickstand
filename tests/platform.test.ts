// Pieces added for Cloudflare Workers: Berlin time on a UTC server, upload sniffing, the rate-limit
// fallback, and the one-query message poll.
import { beforeAll, describe, expect, it } from "vitest";
import { pollMessages, sendMessage, startConversation } from "../src/lib/data/conversations";
import { createListing } from "../src/lib/data/listings";
import { berlinTime, formatTimestamp, todayIso } from "../src/lib/dates";
import { relativeDate } from "../src/lib/listing-format";
import { allow, type Rule } from "../src/lib/rate-limit";
import { sniffImage } from "../src/lib/uploads";
import { ERIKA, listingInput, MAX, OTTO, setupDb } from "./helpers/db";

describe("Berlin time, whatever the server's zone", () => {
  it("formats instants in Europe/Berlin (summer and winter time)", () => {
    expect(formatTimestamp(new Date("2026-07-01T22:30:00Z"))).toBe("02.07.2026, 00:30 Uhr");
    expect(formatTimestamp(new Date("2026-12-31T23:15:00Z"))).toBe("01.01.2027, 00:15 Uhr");
    expect(berlinTime(new Date("2026-01-15T08:05:00Z"))).toBe("09:05");
  });
  it("uses the Berlin calendar day for today and relative dates", () => {
    expect(todayIso(new Date("2026-03-01T23:30:00Z"))).toBe("2026-03-02");
    // 23:30 UTC on 1 March is already 2 March in Berlin, so the same evening counts as "gestern".
    expect(relativeDate(new Date("2026-03-01T20:00:00Z"), new Date("2026-03-01T23:30:00Z"))).toBe("gestern");
  });
});

describe("sniffImage", () => {
  it("accepts JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]))).toBe("jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
  });
  it("rejects anything else, whatever its name or type says", () => {
    expect(sniffImage(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});

describe("rate limit without a Workers binding", () => {
  it("falls back to the in-memory window", async () => {
    const rule: Rule = { name: "test", limit: 2, windowMs: 60_000, binding: "NOT_BOUND" };
    expect(await allow(rule, "k")).toBe(true);
    expect(await allow(rule, "k")).toBe(true);
    expect(await allow(rule, "k")).toBe(false);
    expect(await allow(rule, "other")).toBe(true);
  });
});

describe("pollMessages", () => {
  let conversationId: string;
  beforeAll(async () => {
    await setupDb();
    const listingId = await createListing(ERIKA, listingInput({ title: "Drehmomentschlüssel" }));
    conversationId = await startConversation(listingId, MAX, "Noch da?");
  });

  it("returns the messages to both members and null to anyone else", async () => {
    expect(await pollMessages(conversationId, MAX)).toHaveLength(1);
    expect(await pollMessages(conversationId, ERIKA)).toHaveLength(1);
    expect(await pollMessages(conversationId, OTTO)).toBeNull();
    expect(await pollMessages("nope", MAX)).toBeNull();
  });

  it("returns an empty list, not null, when nothing is new", async () => {
    const msg = await sendMessage(conversationId, ERIKA, "Ja, ist noch da.");
    expect(await pollMessages(conversationId, MAX, msg.createdAt)).toEqual([]);
    const since = new Date(msg.createdAt.getTime() - 1);
    expect((await pollMessages(conversationId, MAX, since))?.map((m) => m.body)).toEqual(["Ja, ist noch da."]);
  });
});

describe("stripJpegMetadata", () => {
  it("removes EXIF and GPS but keeps a valid image", async () => {
    const sharp = (await import("sharp")).default;
    const { stripJpegMetadata } = await import("../src/lib/uploads");
    const withGps = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 120, b: 40 } } })
      .withExif({ IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "52/1 31/1 0/1" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();
    const clean = Buffer.from(stripJpegMetadata(new Uint8Array(withGps)));
    const meta = await sharp(clean).metadata();
    expect(meta.exif).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([64, 48]);
    const { data } = await sharp(clean).raw().toBuffer({ resolveWithObject: true });
    expect(data.length).toBe(64 * 48 * 3);
  });
  it("leaves non-JPEG input alone", async () => {
    const { stripJpegMetadata } = await import("../src/lib/uploads");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(stripJpegMetadata(png)).toBe(png);
  });
});
