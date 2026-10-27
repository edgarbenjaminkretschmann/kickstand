import { describe, expect, it } from "vitest";
import { euroInWords, formatEuro, numberInWords } from "../src/lib/euro-words";

describe("euroInWords", () => {
  it.each([
    [500, "fünfhundert Euro"],
    [1000, "eintausend Euro"],
    [1500, "eintausendfünfhundert Euro"],
    [2500, "zweitausendfünfhundert Euro"],
  ])("%i -> %s", (amount, words) => {
    expect(euroInWords(amount)).toBe(words);
  });

  it("handles the irregular parts", () => {
    expect(numberInWords(1)).toBe("eins");
    expect(numberInWords(21)).toBe("einundzwanzig");
    expect(numberInWords(101)).toBe("einhunderteins");
    expect(numberInWords(1001)).toBe("eintausendeins");
    expect(numberInWords(31_250)).toBe("einunddreißigtausendzweihundertfünfzig");
  });

  it("adds cents when there are any", () => {
    expect(euroInWords(12.5)).toBe("zwölf Euro und fünfzig Cent");
  });
});

describe("formatEuro", () => {
  it("formats German style", () => {
    expect(formatEuro(1000)).toBe("1.000,00 €");
    expect(formatEuro(2500.5)).toBe("2.500,50 €");
    expect(formatEuro(500, false)).toBe("500 €");
  });
});
