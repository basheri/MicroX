// Conflict surfacing + trust resolution (AI-003). PURE.
// When sources disagree on the same key:
//  - a single highest-trust value WINS (override), but the conflict is STILL surfaced
//    (never silently resolved — it must reach the user before approval);
//  - a tie at the highest trust is left UNRESOLVED (needs a human decision).

import { trustRank } from "@/domain/rag/sourceTrust";

export interface Claim {
  key: string;
  value: string;
  sourceType: string;
  sourceId: string;
}

export interface ResolvedClaim {
  key: string;
  value: string;
  sourceType: string;
  sourceId: string;
  resolvedByTrust: boolean; // true when a conflict was overridden by a higher-trust source
}

export interface Conflict {
  key: string;
  winner: { value: string; sourceType: string; sourceId: string } | null; // null => tie, needs human
  losers: { value: string; sourceType: string; sourceId: string }[];
  needsHuman: boolean;
}

export interface ResolutionResult {
  resolved: ResolvedClaim[];
  conflicts: Conflict[];
}

export function resolveClaims(claims: Claim[], table?: Record<string, number>): ResolutionResult {
  const byKey = new Map<string, Claim[]>();
  for (const c of claims) {
    const list = byKey.get(c.key) ?? [];
    list.push(c);
    byKey.set(c.key, list);
  }

  const resolved: ResolvedClaim[] = [];
  const conflicts: Conflict[] = [];

  for (const [key, group] of byKey) {
    const distinctValues = new Set(group.map((c) => c.value));
    if (distinctValues.size === 1) {
      const c = group[0]!;
      resolved.push({ ...c, resolvedByTrust: false });
      continue;
    }

    // Disagreement: rank by trust.
    const ranked = [...group].sort(
      (a, b) => trustRank(b.sourceType, table) - trustRank(a.sourceType, table),
    );
    const topTrust = trustRank(ranked[0]!.sourceType, table);
    const topClaims = ranked.filter((c) => trustRank(c.sourceType, table) === topTrust);
    const topValues = new Set(topClaims.map((c) => c.value));

    if (topValues.size === 1) {
      // Single highest-trust value -> override, but surface the conflict.
      const winner = topClaims[0]!;
      const losers = ranked
        .filter((c) => c.value !== winner.value)
        .map((c) => ({ value: c.value, sourceType: c.sourceType, sourceId: c.sourceId }));
      resolved.push({ ...winner, resolvedByTrust: true });
      conflicts.push({
        key,
        winner: { value: winner.value, sourceType: winner.sourceType, sourceId: winner.sourceId },
        losers,
        needsHuman: false,
      });
    } else {
      // Tie at the top trust -> do NOT auto-resolve; surface for a human decision.
      conflicts.push({
        key,
        winner: null,
        losers: ranked.map((c) => ({
          value: c.value,
          sourceType: c.sourceType,
          sourceId: c.sourceId,
        })),
        needsHuman: true,
      });
    }
  }

  return { resolved, conflicts };
}
