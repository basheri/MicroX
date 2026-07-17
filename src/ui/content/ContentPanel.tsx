"use client";

// SC-16 — self-paced content: resources + formative activities. Every activity is
// labelled formative-only (BR-009: never counted toward passing). RTL Arabic.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface Resource {
  id: string;
  resource_type: string | null;
  title: string | null;
  duration_minutes: number | null;
}
interface Activity {
  id: string;
  title: string | null;
  is_formative: boolean;
}

export function ContentPanel({ lessonId }: { lessonId: string }) {
  const { actor } = useActor();
  const [resources, setResources] = useState<Resource[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityTitle, setActivityTitle] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/lessons/${lessonId}/content`);
    const data = await res.json();
    setResources(data.resources ?? []);
    setActivities(data.activities ?? []);
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/lessons/${lessonId}/content`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ kind: "activity", title: activityTitle }),
    });
    setActivityTitle("");
    await load();
  }

  return (
    <section aria-label="محتوى الدرس">
      <h2>المصادر ({resources.length})</h2>
      <ul>
        {resources.map((r) => (
          <li key={r.id}>
            {r.title ?? "مصدر"}{" "}
            {r.duration_minutes ? <Bidi>{r.duration_minutes} دقيقة</Bidi> : null}
          </li>
        ))}
      </ul>

      <h2>الأنشطة التكوينية ({activities.length})</h2>
      <p role="note">
        الأنشطة تكوينية فقط ولا تُحتسب في تحديد النجاح (BR-009). النجاح يُحدَّد بالاختبار الشامل
        النهائي فقط.
      </p>
      <ul>
        {activities.map((a) => (
          <li key={a.id}>
            {a.title} —{" "}
            <strong>{a.is_formative ? "تكويني (لا يُحتسب في النجاح)" : "غير تكويني"}</strong>
          </li>
        ))}
      </ul>

      <form onSubmit={addActivity} aria-label="إضافة نشاط">
        <label htmlFor="activity-title">عنوان النشاط</label>
        <input
          id="activity-title"
          value={activityTitle}
          onChange={(e) => setActivityTitle(e.target.value)}
        />
        <button type="submit" disabled={!activityTitle.trim()}>
          إضافة نشاط تكويني
        </button>
      </form>
    </section>
  );
}
