// Program generator (EP-09). Async generation jobs with progress + cancel, section
// pinning, impact analysis that APPLIES NOTHING, and preview-before-apply for every
// mutation (no silent changes). Generation requires an APPROVED market analysis (EP-08).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import {
  createJob,
  getJob,
  setJobStatus,
  setJobProgress,
  upsertSectionPreview,
  listSections,
  getSection,
  applySection,
  setSectionPinned,
  pinnedSectionKeys,
  type GeneratedSection,
} from "@/data/generationRepo";
import { requireApprovedMarketAnalysis } from "@/services/marketAnalysisService";
import { generateStructured, assembleProgramContext } from "@/services/ragService";
import {
  SECTION_KEYS,
  isSectionKey,
  impactedSections,
  type SectionKey,
} from "@/domain/generation/sections";
import type { LLMProvider } from "@/services/llm/types";

const SECTION_SCHEMA = {
  type: "object",
  required: ["content"],
  properties: { content: { type: "string" } },
  additionalProperties: false,
} as const;

// Create a QUEUED job after enforcing the EP-08 precondition. Returns the job id.
// (Running is a separate step so the queue/worker drives it asynchronously — D-05.)
export async function startGeneration(
  programId: string,
  opts: { jobType?: string; sectionKeys?: SectionKey[] },
  actor: string,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("startGeneration: program not found");

  // HARD precondition: no generation without an approved market analysis (rule 20).
  await requireApprovedMarketAnalysis(programId);

  return createJob({ programId, jobType: opts.jobType ?? "quick", actor });
}

async function generateSection(
  provider: LLMProvider,
  programId: string,
  sectionKey: string,
  contextText: string,
): Promise<unknown> {
  const { data } = await generateStructured<{ content: string }>(
    {
      messages: [
        { role: "system", content: 'ولّد محتوى القسم بصيغة JSON: {"content": "..."}.' },
        { role: "user", content: `القسم: ${sectionKey}\nالسياق:\n${contextText}` },
      ],
      schema: SECTION_SCHEMA as unknown as Record<string, unknown>,
      programId,
    },
    provider,
  );
  return data;
}

// Run a queued job: generate each section as a PREVIEW, reporting progress and stopping
// promptly if the job is cancelled. Pinned sections are never overwritten (regenerate).
export async function runGenerationJob(
  jobId: string,
  actor: string,
  provider: LLMProvider,
  opts: { sectionKeys?: SectionKey[]; skipPinned?: boolean } = {},
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error("runGenerationJob: job not found");
  const programId = job.program_id;

  const pinned = opts.skipPinned ? await pinnedSectionKeys(programId) : new Set<string>();
  const keys = (opts.sectionKeys ?? [...SECTION_KEYS]).filter((k) => !pinned.has(k));

  await setJobStatus(jobId, "running");
  const context = await assembleProgramContext(programId);

  let done = 0;
  for (const key of keys) {
    // Cancellation check BEFORE each section — a cancelled job stops here.
    const current = await getJob(jobId);
    if (current?.status === "cancelled") return;

    const content = await generateSection(provider, programId, key, context.contextText);
    await withTransaction(async (client) => {
      const sink = new PgAuditSink(client);
      await withAudit(
        {
          actor_name: actor,
          operation_type: "generation.preview_section",
          program_id: programId,
          section_ref: key,
        },
        async () => {
          await upsertSectionPreview(client, { programId, jobId, sectionKey: key, content, actor });
        },
        sink,
      );
    });

    done += 1;
    await setJobProgress(jobId, (done / keys.length) * 100);
  }

  // Final cancellation check before marking done.
  const final = await getJob(jobId);
  if (final?.status === "cancelled") return;
  await setJobStatus(jobId, "done");
}

export async function cancelGenerationJob(jobId: string, actor: string): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "generation.cancel", new_value: { jobId } },
      async () => {
        await client.query(
          "update generation_jobs set status = 'cancelled', updated_at = now() where id = $1 and status in ('queued','running')",
          [jobId],
        );
      },
      sink,
    );
  });
}

export interface ImpactReport {
  changed: SectionKey;
  affectedKeys: SectionKey[];
  affectedExisting: { sectionId: string; sectionKey: string; status: string }[];
  applied: false; // explicit: impact analysis NEVER applies anything
}

// Impact analysis: LIST the sections a change would affect. READ-ONLY — no writes.
export async function impactAnalysis(
  programId: string,
  changedSectionKey: string,
): Promise<ImpactReport> {
  if (!isSectionKey(changedSectionKey)) throw new Error(`قسم غير صالح: ${changedSectionKey}`);
  const affectedKeys = impactedSections(changedSectionKey);
  const existing = await listSections(programId);
  const affectedExisting = existing
    .filter((s) => affectedKeys.includes(s.section_key as SectionKey))
    .map((s) => ({ sectionId: s.id, sectionKey: s.section_key, status: s.status }));
  return { changed: changedSectionKey, affectedKeys, affectedExisting, applied: false };
}

// The ONLY path that applies a generated section — explicit, after preview (AI-006).
export async function applyGeneratedSection(sectionId: string, actor: string): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "generation.apply_section", new_value: { sectionId } },
      async () => {
        const ok = await applySection(client, sectionId, actor);
        if (!ok) throw new Error("applyGeneratedSection: section not previewed or not found");
      },
      sink,
    );
  });
}

export async function pinGeneratedSection(
  sectionId: string,
  pinned: boolean,
  actor: string,
): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await setSectionPinned(sectionId, pinned);
}

export async function getGenerationState(programId: string): Promise<{
  sections: GeneratedSection[];
}> {
  return { sections: await listSections(programId) };
}

export { getJob, getSection };
