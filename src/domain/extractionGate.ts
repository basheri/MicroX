// Extraction confidence gate (AI-005 / TC-09). PURE + testable.
// Low-confidence extracted content is BLOCKED from downstream use until a human
// reviews it (approves or corrects). This is the deterministic rule the data layer
// and services enforce.

// Operational threshold (tunable — NOT a business rule). Content scoring below this
// is "low confidence". Can move to application_settings later without code changes.
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export type ReviewStatus = "approved" | "corrected" | "rejected" | null;

export interface BlockGateInput {
  confidence: number | null;
  reviewStatus: ReviewStatus;
}

// May this block be consumed downstream (RAG/generation)?
// - approved/corrected review -> yes (a human cleared it)
// - rejected review           -> no
// - no review                 -> only if confidence is at/above the threshold
export function isUsable(
  input: BlockGateInput,
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): boolean {
  if (input.reviewStatus === "approved" || input.reviewStatus === "corrected") return true;
  if (input.reviewStatus === "rejected") return false;
  return (input.confidence ?? 0) >= threshold;
}

// Does this block still require human review before it can be used?
// (low confidence AND not yet reviewed)
export function needsReview(
  input: BlockGateInput,
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): boolean {
  return input.reviewStatus === null && (input.confidence ?? 0) < threshold;
}

export function isLowConfidence(
  confidence: number | null,
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): boolean {
  return (confidence ?? 0) < threshold;
}
