// Feasibility rating rules (EP-08). PURE. A "weak" rating must carry a written
// justification (schema: feasibility_assessments.justification — enforced here).

export const FEASIBILITY_RATINGS = ["high", "medium", "low", "insufficient_evidence"] as const;
export type FeasibilityRating = (typeof FEASIBILITY_RATINGS)[number];

// Weak = low confidence in viability; needs the analyst to justify proceeding.
const WEAK: ReadonlySet<FeasibilityRating> = new Set(["low", "insufficient_evidence"]);

export function isFeasibilityRating(value: string): value is FeasibilityRating {
  return (FEASIBILITY_RATINGS as readonly string[]).includes(value);
}

export function isWeakRating(rating: FeasibilityRating): boolean {
  return WEAK.has(rating);
}

export class FeasibilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeasibilityValidationError";
  }
}

// Throws when a weak rating has no justification.
export function validateFeasibility(input: {
  rating: string;
  justification?: string | null;
}): FeasibilityRating {
  if (!isFeasibilityRating(input.rating)) {
    throw new FeasibilityValidationError(`تقدير جدوى غير صالح: ${input.rating}`);
  }
  if (isWeakRating(input.rating) && !input.justification?.trim()) {
    throw new FeasibilityValidationError(
      "التقدير ضعيف (منخفض/أدلة غير كافية) ويتطلب تبريرًا مكتوبًا قبل الحفظ.",
    );
  }
  return input.rating;
}
