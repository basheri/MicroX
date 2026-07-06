// References & verification service (EP-14 / AI-004). Adds references (unverified),
// checks existence, and FLAGS anything unverifiable — a fabricated/unresolvable
// reference is rejected (verified=false + note) and never appears in the verified list.

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import {
  insertReference,
  setVerification,
  getReference,
  listReferences,
  listUnverifiedIds,
  type ReferenceRow,
} from "@/data/referenceRepo";
import { defaultReferenceVerifier, type ReferenceVerifier } from "@/services/references/verifier";

export async function addReference(
  programId: string,
  input: { citation: string; language?: "ar" | "en"; refType?: string },
  actor: string,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  if (!input.citation?.trim()) throw new Error("نص الاقتباس مطلوب.");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("addReference: program not found");

  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let refId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "reference.add",
        program_id: programId,
        new_value: { citation: input.citation },
      },
      async () => {
        refId = await insertReference(client, {
          programId,
          citation: input.citation,
          language: input.language ?? null,
          refType: input.refType ?? null,
        });
      },
      sink,
    );
    return refId;
  });
}

// Verify a reference's existence. On failure it is FLAGGED (verified=false + note),
// not accepted. Returns the updated row.
export async function verifyReference(
  refId: string,
  actor: string,
  verifier: ReferenceVerifier = defaultReferenceVerifier,
): Promise<ReferenceRow> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const ref = await getReference(refId);
  if (!ref) throw new Error("verifyReference: reference not found");

  const result = await verifier.verify(ref.citation);

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "reference.verify",
        program_id: ref.program_id,
        new_value: { refId, verified: result.exists, note: result.note },
      },
      async () => {
        await setVerification(client, refId, result.exists, result.note);
      },
      sink,
    );
  });
  return (await getReference(refId))!;
}

// Verify every unverified reference in a program (e.g. after generation).
export async function verifyAllReferences(
  programId: string,
  actor: string,
  verifier: ReferenceVerifier = defaultReferenceVerifier,
): Promise<{ verified: number; flagged: number }> {
  const ids = await listUnverifiedIds(programId);
  let verified = 0;
  let flagged = 0;
  for (const id of ids) {
    const row = await verifyReference(id, actor, verifier);
    if (row.verified) verified += 1;
    else flagged += 1;
  }
  return { verified, flagged };
}

// AR/EN lists.
export function listReferencesByLanguage(programId: string, language: "ar" | "en") {
  return listReferences(programId, { language });
}

// Only VERIFIED references (the ones that may enter the official package).
export function getVerifiedReferences(programId: string) {
  return listReferences(programId, { verified: true });
}

// Rejected/flagged references (unverifiable — surfaced, never silently included).
export function getFlaggedReferences(programId: string) {
  return listReferences(programId, { verified: false });
}

export { listReferences };
