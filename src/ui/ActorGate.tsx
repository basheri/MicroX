"use client";

// SC-01 — name-entry gate. Before any work, the user types their name once.
// Until `actor_name` is set, the app shows the name form and blocks the content
// behind it (every write must be attributed — rule 00). Arabic, RTL.

import { useState, type ReactNode } from "react";
import { useActor } from "@/lib/actor";

export function ActorGate({ children }: { children: ReactNode }) {
  const { isIdentified, ready, save } = useActor();
  const [name, setName] = useState("");

  // Avoid a hydration flash before the client knows whether a name exists.
  if (!ready) return null;

  if (isIdentified) return <>{children}</>;

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>منصة MicroX</h1>
      <p>الرجاء إدخال اسمك للمتابعة. يُسجَّل اسمك مع كل عملية في سجل التدقيق.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save(name);
        }}
      >
        <label htmlFor="actor-name">الاسم</label>
        <input
          id="actor-name"
          name="actor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          style={{ display: "block", width: "100%", padding: "0.5rem", margin: "0.5rem 0" }}
        />
        <button type="submit" disabled={!name.trim()}>
          متابعة
        </button>
      </form>
    </main>
  );
}
