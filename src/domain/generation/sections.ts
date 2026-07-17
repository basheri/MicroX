// Generation sections + impact map (EP-09). PURE. Impact analysis uses this dependency
// graph to LIST sections affected by a change — it computes, it never mutates.

export const SECTION_KEYS = [
  "program_structure",
  "outcomes",
  "courses",
  "content",
  "questions",
  "references",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

// Downstream dependencies: changing a key may affect these sections (alignment chain
// need -> skill -> PLO -> CLO -> unit -> content -> activity -> question).
const DOWNSTREAM: Record<SectionKey, SectionKey[]> = {
  program_structure: ["outcomes", "courses", "content", "questions", "references"],
  outcomes: ["courses", "content", "questions"],
  courses: ["content", "questions"],
  content: ["questions"],
  questions: [],
  references: [],
};

// Sections impacted by changing `changed` (the change itself + its downstream deps).
// Read-only: returns a list, applies nothing.
export function impactedSections(changed: SectionKey): SectionKey[] {
  const out = new Set<SectionKey>([changed]);
  const visit = (k: SectionKey) => {
    for (const d of DOWNSTREAM[k]) {
      if (!out.has(d)) {
        out.add(d);
        visit(d);
      }
    }
  };
  visit(changed);
  return SECTION_KEYS.filter((k) => out.has(k));
}
