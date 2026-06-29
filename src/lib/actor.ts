"use client";

// actor_name capture (rule 00 / SC-01): no login. The user types their name once;
// it lives in localStorage and is attached to every write + audit entry.
// There are no accounts or roles — anyone with the link has full permissions.

import { useCallback, useEffect, useState } from "react";

export const ACTOR_STORAGE_KEY = "actor_name";

export function getActorName(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ACTOR_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setActorName(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed.length === 0) return;
  window.localStorage.setItem(ACTOR_STORAGE_KEY, trimmed);
  window.dispatchEvent(new Event("actor:changed"));
}

export function clearActorName(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTOR_STORAGE_KEY);
  window.dispatchEvent(new Event("actor:changed"));
}

// React hook exposing the current actor and a setter. `ready` flips true after the
// first client read so the UI can avoid an SSR/hydration flash before deciding to
// show the name gate.
export function useActor() {
  const [actor, setActor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setActor(getActorName());
    setReady(true);
    const sync = () => setActor(getActorName());
    window.addEventListener("actor:changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("actor:changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((name: string) => setActorName(name), []);
  const clear = useCallback(() => clearActorName(), []);

  return { actor, ready, isIdentified: actor !== null, save, clear };
}
