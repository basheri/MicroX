import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActorGate } from "@/ui/ActorGate";

describe("ActorGate (SC-01)", () => {
  it("blocks content behind the name form until a name is entered", async () => {
    render(
      <ActorGate>
        <div>المحتوى المحمي</div>
      </ActorGate>,
    );

    // Gate visible, protected content hidden.
    expect(screen.queryByText("المحتوى المحمي")).not.toBeInTheDocument();
    const input = screen.getByLabelText("الاسم");

    await userEvent.type(input, "نورة");
    await userEvent.click(screen.getByRole("button", { name: "متابعة" }));

    // Name set -> protected content revealed.
    expect(await screen.findByText("المحتوى المحمي")).toBeInTheDocument();
  });
});
