import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bidi } from "@/ui/Bidi";

describe("Bidi isolation (rule 50)", () => {
  it("wraps embedded LTR content in an isolated dir=ltr span", () => {
    render(<Bidi>EP-01</Bidi>);
    const el = screen.getByText("EP-01");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("dir", "ltr");
    expect(el).toHaveClass("bidi-ltr");
    expect(el).toHaveStyle({ unicodeBidi: "isolate" });
  });
});
