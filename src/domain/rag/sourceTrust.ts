// Source-priority ordering (AI-003). Higher-trust sources (official guide/template)
// override lower-trust ones. PURE + data-driven: the ranking is a tunable operational
// map (NOT an academic constraint) and can move to application_settings without code
// changes. Unknown source types get the lowest trust.

export const DEFAULT_SOURCE_TRUST: Record<string, number> = {
  official_guide: 100, // NELC guide
  official_template: 100, // official Word template
  from_center: 80, // الديوان/المركز
  from_university: 60, // الجامعة
  align_existing: 40, // مواءمة برنامج قائم
  professional_sector: 20, // القطاع المهني
};

export function trustRank(
  sourceType: string,
  table: Record<string, number> = DEFAULT_SOURCE_TRUST,
): number {
  return table[sourceType] ?? 0;
}

// Comparator: higher trust first; ties keep the original order (stable via index).
export function byTrustDesc<T extends { sourceType: string; order?: number }>(
  table: Record<string, number> = DEFAULT_SOURCE_TRUST,
): (a: T, b: T) => number {
  return (a, b) => {
    const d = trustRank(b.sourceType, table) - trustRank(a.sourceType, table);
    if (d !== 0) return d;
    return (a.order ?? 0) - (b.order ?? 0);
  };
}
