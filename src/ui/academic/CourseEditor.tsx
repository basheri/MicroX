"use client";

// SC-13 — course editor. Add courses with credit hours; BR-001 (2..6 courses) and
// BR-003 (1..10 credit hours) violations are shown in clear Arabic. Western numerals.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface Course {
  id: string;
  title: string;
  credit_hours: number;
  actual_hours: number;
}
interface RuleIssue {
  ruleCode: string;
  message: string;
}

export function CourseEditor({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [courses, setCourses] = useState<Course[]>([]);
  const [issues, setIssues] = useState<RuleIssue[]>([]);
  const [title, setTitle] = useState("");
  const [creditHours, setCreditHours] = useState("3");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/courses`);
    const data = await res.json();
    setCourses(data.courses ?? []);
    setIssues(data.issues ?? []);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/programs/${programId}/courses`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ title, creditHours: Number(creditHours) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "تعذّرت الإضافة.");
      return;
    }
    setTitle("");
    await load();
  }

  return (
    <section aria-label="محرر المقررات">
      <h2>المقررات ({courses.length})</h2>

      {issues.length > 0 && (
        <ul role="alert">
          {issues.map((i) => (
            <li key={i.ruleCode}>{i.message}</li>
          ))}
        </ul>
      )}

      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            {c.title} — <Bidi>{c.credit_hours}</Bidi> ساعة معتمدة (<Bidi>{c.actual_hours}</Bidi>{" "}
            ساعة فعلية)
          </li>
        ))}
      </ul>

      <form onSubmit={add} aria-label="إضافة مقرر">
        <label htmlFor="course-title">اسم المقرر</label>
        <input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="course-credits">الساعات المعتمدة</label>
        <input
          id="course-credits"
          type="number"
          min={1}
          max={10}
          value={creditHours}
          onChange={(e) => setCreditHours(e.target.value)}
        />
        <button type="submit" disabled={!title.trim()}>
          إضافة مقرر
        </button>
      </form>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
