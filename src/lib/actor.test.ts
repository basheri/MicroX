import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  getActorName,
  setActorName,
  clearActorName,
  useActor,
  ACTOR_STORAGE_KEY,
} from "@/lib/actor";

describe("actor_name capture (rule 00 / SC-01)", () => {
  it("persists and reads the actor name from localStorage", () => {
    expect(getActorName()).toBeNull();
    setActorName("منى العتيبي");
    expect(getActorName()).toBe("منى العتيبي");
    expect(window.localStorage.getItem(ACTOR_STORAGE_KEY)).toBe("منى العتيبي");
  });

  it("ignores blank names and trims whitespace", () => {
    setActorName("   ");
    expect(getActorName()).toBeNull();
    setActorName("  أحمد  ");
    expect(getActorName()).toBe("أحمد");
  });

  it("clears the actor name", () => {
    setActorName("سارة");
    clearActorName();
    expect(getActorName()).toBeNull();
  });

  it("useActor reports identification state after the client read", () => {
    const { result } = renderHook(() => useActor());
    expect(result.current.ready).toBe(true);
    expect(result.current.isIdentified).toBe(false);

    act(() => result.current.save("خالد"));
    expect(result.current.actor).toBe("خالد");
    expect(result.current.isIdentified).toBe(true);
  });
});
