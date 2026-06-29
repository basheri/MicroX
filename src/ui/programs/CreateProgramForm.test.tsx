import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProgramForm } from "@/ui/programs/CreateProgramForm";
import { setActorName } from "@/lib/actor";

const sectors = [{ id: "s1", name: "التقنية" }];
const fields = [
  { id: "f1", sector_id: "s1", name: "الأمن السيبراني" },
  { id: "f2", sector_id: "s2", name: "مجال آخر" },
];

describe("CreateProgramForm (SC-02)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("posts name+sector+field with the actor header and signals creation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ program: { id: "p1" } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const onCreated = vi.fn();

    render(<CreateProgramForm sectors={sectors} fields={fields} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText("اسم البرنامج"), "برنامج جديد");
    await userEvent.selectOptions(screen.getByLabelText("القطاع"), "s1");
    // Only the chosen sector's fields are offered (no f2).
    expect(screen.queryByRole("option", { name: "مجال آخر" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("المجال"), "f1");
    await userEvent.click(screen.getByRole("button", { name: "إنشاء" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/programs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-actor-name": "منى" }),
        body: JSON.stringify({ name: "برنامج جديد", sectorId: "s1", fieldId: "f1" }),
      }),
    );
  });

  it("shows the server error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "تعذّر إنشاء البرنامج." }),
      })) as unknown as typeof fetch,
    );
    render(<CreateProgramForm sectors={sectors} fields={fields} />);
    await userEvent.type(screen.getByLabelText("اسم البرنامج"), "س");
    await userEvent.selectOptions(screen.getByLabelText("القطاع"), "s1");
    await userEvent.selectOptions(screen.getByLabelText("المجال"), "f1");
    await userEvent.click(screen.getByRole("button", { name: "إنشاء" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر إنشاء البرنامج.");
  });
});
