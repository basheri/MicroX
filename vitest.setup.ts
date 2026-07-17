import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Reset DOM and storage between tests so the actor gate / flags start clean.
afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});
