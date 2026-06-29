"use client";

// SC-02 + SC-03 — program creation and dashboard, behind the actor name gate (SC-01).
// Client-side: fetches lookups from /api/lookups so the production build needs no DB.

import { useCallback, useEffect, useState } from "react";
import { ActorGate } from "@/ui/ActorGate";
import { CreateProgramForm } from "@/ui/programs/CreateProgramForm";
import { ProgramsDashboard } from "@/ui/programs/ProgramsDashboard";
import type { Sector, Field, DevelopmentPath } from "@/data/lookupsRepo";

interface Lookups {
  sectors: Sector[];
  fields: Field[];
  developmentPaths: DevelopmentPath[];
}

export default function ProgramsPage() {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    void fetch("/api/lookups")
      .then((r) => r.json())
      .then(setLookups)
      .catch(() => setLookups({ sectors: [], fields: [], developmentPaths: [] }));
  }, []);

  const onCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <ActorGate>
      <main style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>منصة MicroX</h1>
        {lookups ? (
          <>
            <CreateProgramForm
              sectors={lookups.sectors}
              fields={lookups.fields}
              onCreated={onCreated}
            />
            <ProgramsDashboard key={refreshKey} lookups={lookups} />
          </>
        ) : (
          <p>جارٍ التحميل…</p>
        )}
      </main>
    </ActorGate>
  );
}
