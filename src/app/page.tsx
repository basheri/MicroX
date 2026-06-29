import { ActorGate } from "@/ui/ActorGate";
import { Bidi } from "@/ui/Bidi";

// EP-01 landing shell: proves the RTL Arabic shell renders behind the name gate.
// Real screens (SC-02..30) arrive in their epics.
export default function HomePage() {
  return (
    <ActorGate>
      <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem" }}>
        <h1>منصة MicroX</h1>
        <p>
          منصة عمادة التعلم الإلكتروني بجامعة الملك عبدالعزيز لبناء البرامج الجامعية القصيرة (
          <Bidi>MicroX</Bidi>) — من تحليل سوق العمل حتى حزمة التصدير الرسمية.
        </p>
        <p>
          البنية الأساسية جاهزة (<Bidi>EP-01</Bidi>). الوحدات التالية تُبنى مرحلةً بمرحلة وفق خطة
          العمل.
        </p>
      </main>
    </ActorGate>
  );
}
