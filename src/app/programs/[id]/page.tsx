"use client";

// Program workspace — the hub that makes every feature reachable for one program.
// Each tab renders a real panel wired to its own API (no mock UI). RTL Arabic.

import { useState } from "react";
import { ActorGate } from "@/ui/ActorGate";
import { useActor } from "@/lib/actor";
import { SourcesUpload } from "@/ui/sources/SourcesUpload";
import { MarketAnalysis } from "@/ui/market/MarketAnalysis";
import { CourseEditor } from "@/ui/academic/CourseEditor";
import { AlignmentGaps } from "@/ui/academic/AlignmentGaps";
import { HoursSchedule } from "@/ui/hours/HoursSchedule";
import { ReferencesPanel } from "@/ui/references/ReferencesPanel";
import { GenerationPanel } from "@/ui/generation/GenerationPanel";
import { QualityPanel } from "@/ui/quality/QualityPanel";
import { CompliancePanel } from "@/ui/compliance/CompliancePanel";
import { CenterFeedbackPanel } from "@/ui/feedback/CenterFeedbackPanel";
import { VersionsPanel } from "@/ui/versions/VersionsPanel";
import { ExportPackagePanel } from "@/ui/export/ExportPackagePanel";

type TabKey =
  | "sources"
  | "market"
  | "structure"
  | "hours"
  | "references"
  | "generation"
  | "quality"
  | "compliance"
  | "feedback"
  | "versions"
  | "export";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sources", label: "المصادر" },
  { key: "market", label: "تحليل السوق" },
  { key: "structure", label: "المقررات والمواءمة" },
  { key: "hours", label: "الساعات والجدولة" },
  { key: "references", label: "المراجع" },
  { key: "generation", label: "التوليد" },
  { key: "quality", label: "الجودة" },
  { key: "compliance", label: "التوافق" },
  { key: "feedback", label: "ملاحظات المركز" },
  { key: "versions", label: "النسخ والنشر" },
  { key: "export", label: "التصدير" },
];

// The export tab needs a template version to fill; prepare one on demand.
function ExportTab({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [versionId, setVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    setError(null);
    const res = await fetch(`/api/programs/${programId}/template`, {
      method: "POST",
      headers: { "x-actor-name": actor ?? "" },
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "تعذّر تجهيز القالب.");
    setVersionId(data.result.versionId);
  }

  if (!versionId) {
    return (
      <div>
        <p role="note">
          لتجهيز حزمة التصدير يجب تحضير نسخة القالب (نسخة بديلة معلّمة حتى تركيب القالب الرسمي
          V-01/V-06).
        </p>
        <button onClick={prepare}>تجهيز القالب</button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }
  return <ExportPackagePanel programId={programId} templateVersionId={versionId} />;
}

export default function ProgramWorkspace({ params }: { params: { id: string } }) {
  const programId = params.id;
  const [tab, setTab] = useState<TabKey>("sources");

  return (
    <ActorGate>
      <main style={{ maxWidth: 1000, margin: "1.5rem auto", padding: "0 1rem" }}>
        <p>
          <a href="/programs">→ رجوع إلى قائمة البرامج</a>
        </p>
        <h1>مساحة عمل البرنامج</h1>

        <div
          role="tablist"
          aria-label="أقسام البرنامج"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1rem 0" }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "0.4rem 0.8rem",
                fontWeight: tab === t.key ? 700 : 400,
                borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === "sources" && <SourcesUpload programId={programId} />}
          {tab === "market" && <MarketAnalysis programId={programId} />}
          {tab === "structure" && (
            <>
              <CourseEditor programId={programId} />
              <AlignmentGaps programId={programId} />
            </>
          )}
          {tab === "hours" && <HoursSchedule programId={programId} />}
          {tab === "references" && <ReferencesPanel programId={programId} />}
          {tab === "generation" && <GenerationPanel programId={programId} />}
          {tab === "quality" && <QualityPanel programId={programId} />}
          {tab === "compliance" && <CompliancePanel programId={programId} />}
          {tab === "feedback" && <CenterFeedbackPanel programId={programId} />}
          {tab === "versions" && <VersionsPanel programId={programId} />}
          {tab === "export" && <ExportTab programId={programId} />}
        </div>
      </main>
    </ActorGate>
  );
}
