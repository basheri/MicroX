// Single source of truth for the Arabic-only, strict-RTL shell (rule 50-arabic-rtl-ui).
// The whole UI is `dir="rtl"` and `lang="ar"`; English/IDs are bidi-isolated
// (see ui/Bidi.tsx) and digits are always Western (0-9).

export const RTL = {
  lang: "ar",
  dir: "rtl",
} as const;

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

// Maps Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to Western 0-9.
export function toWesternNumerals(input: string): string {
  return input.replace(ARABIC_INDIC_DIGITS, (d) => {
    const code = d.codePointAt(0)!;
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return String(code - 0x06f0);
  });
}

// True when the string contains only Western digits among its digit characters.
export function isWesternNumeralsOnly(input: string): boolean {
  return !ARABIC_INDIC_DIGITS.test(input);
}
