import { describe, expect, it } from "vitest";
import { addDays, formatDate, formatDateTime, parseDate, parseTime } from "../src/lib/dates";

describe("formatDate", () => {
  it("shows ISO dates as DD.MM.YYYY", () => {
    expect(formatDate("1995-05-23")).toBe("23.05.1995");
    expect(formatDate("2026-10-23T14:05")).toBe("23.10.2026");
  });
  it("returns empty string for empty values", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
  });
  it("formats date and time together", () => {
    expect(formatDateTime("2026-05-01", "10:00")).toBe("01.05.2026, 10:00 Uhr");
    expect(formatDateTime("2026-05-14T18:30")).toBe("14.05.2026, 18:30 Uhr");
    expect(formatDateTime("2026-05-14")).toBe("14.05.2026");
  });
});

describe("parseDate", () => {
  it("parses German input regardless of browser locale", () => {
    expect(parseDate("23.05.1995")).toBe("1995-05-23");
    expect(parseDate("1.2.2026")).toBe("2026-02-01");
    expect(parseDate("01.02.26")).toBe("2026-02-01");
    expect(parseDate("2026-10-23")).toBe("2026-10-23");
  });
  it("rejects invalid dates instead of guessing", () => {
    expect(parseDate("05/23/1995")).toBeNull();
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("13.13.2026")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
  it("accepts 29 February only in leap years", () => {
    expect(parseDate("29.02.2028")).toBe("2028-02-29");
    expect(parseDate("29.02.2027")).toBeNull();
  });
});

describe("parseTime / addDays", () => {
  it("normalises times", () => {
    expect(parseTime("9:05")).toBe("09:05");
    expect(parseTime("18.30")).toBe("18:30");
    expect(parseTime("1830")).toBe("18:30");
    expect(parseTime("930")).toBe("09:30");
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("9:5")).toBeNull();
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("dates in other languages", () => {
  it("uses DD/MM/YYYY and no 'Uhr' outside German", async () => {
    const { formatTimestamp } = await import("../src/lib/dates");
    expect(formatDate("2026-10-23", "en")).toBe("23/10/2026");
    expect(formatDateTime("2026-10-23T14:05", null, "fr")).toBe("23/10/2026, 14:05");
    expect(formatDateTime("2026-10-23", "14:05")).toBe("23.10.2026, 14:05 Uhr");
    expect(formatTimestamp(new Date("2026-07-01T22:30:00Z"), "pt")).toBe("02/07/2026, 00:30");
  });
  it("parses dates typed with slashes", () => {
    expect(parseDate("23/10/2026")).toBe("2026-10-23");
    expect(parseDate("1/2/26")).toBe("2026-02-01");
    expect(parseDate("31/02/2026")).toBeNull();
  });
});
