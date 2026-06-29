import { describe, it, expect } from "vitest";
import { RTL, toWesternNumerals, isWesternNumeralsOnly } from "@/lib/rtl";

describe("RTL shell config (rule 50)", () => {
  it("declares the Arabic-only, strict-RTL document attributes", () => {
    expect(RTL.lang).toBe("ar");
    expect(RTL.dir).toBe("rtl");
  });

  it("converts Arabic-Indic digits to Western numerals", () => {
    expect(toWesternNumerals("البرنامج ٢٣ ساعة")).toBe("البرنامج 23 ساعة");
    expect(toWesternNumerals("۱۵")).toBe("15");
  });

  it("detects non-Western numerals", () => {
    expect(isWesternNumeralsOnly("6 مقررات")).toBe(true);
    expect(isWesternNumeralsOnly("٦ مقررات")).toBe(false);
  });
});
