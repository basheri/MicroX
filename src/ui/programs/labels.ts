// Arabic display labels for the defined stage codes and approval states (rule 50).
// These are translations of values that already exist in the schema — not new rules.

import { STAGES, type Stage } from "@/domain/stages";

export const STAGE_LABELS: Record<Stage, string> = {
  new: "جديد",
  sources: "المصادر",
  market: "تحليل سوق العمل",
  feasibility: "الجدوى",
  structure: "هيكل البرنامج",
  outcomes: "مخرجات التعلم",
  courses: "المقررات",
  content: "المحتوى",
  hours: "الساعات والجدولة",
  questions: "بنك الأسئلة",
  references: "المراجع",
  review: "المراجعة",
  compliance: "المطابقة",
  export: "التصدير",
};

export const APPROVAL_LABELS: Record<string, string> = {
  not_approved: "غير معتمد",
  submitted: "مُقدّم",
  approved: "معتمد",
  returned: "مُعاد",
};

export const ORDERED_STAGES: { code: Stage; label: string }[] = STAGES.map((code) => ({
  code,
  label: STAGE_LABELS[code],
}));
