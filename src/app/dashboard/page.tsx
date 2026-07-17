// SC-03 — operational dashboard (metrics). Behind the actor-name gate.
import { ActorGate } from "@/ui/ActorGate";
import { MetricsPanel } from "@/ui/dashboard/MetricsPanel";

export default function DashboardPage() {
  return (
    <ActorGate>
      <main style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
        <MetricsPanel />
      </main>
    </ActorGate>
  );
}
