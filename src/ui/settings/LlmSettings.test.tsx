import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LlmSettings } from "@/ui/settings/LlmSettings";
import { setActorName } from "@/lib/actor";

describe("LlmSettings (SC-27)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows the masked key and never the full key, and saves model + new key", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const u = String(urlArg);
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (u === "/api/settings/llm" && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            modelId: "openai/gpt-4o",
            maskedKey: "••••••••7890",
            hasKey: true,
            lastTestedAt: null,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          modelId: "openai/gpt-4o",
          maskedKey: "••••••••0000",
          hasKey: true,
          lastTestedAt: null,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<LlmSettings />);

    expect(await screen.findByText(/7890/)).toBeInTheDocument();
    // The plaintext key is never present.
    expect(screen.queryByDisplayValue(/sk-or/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("مفتاح OpenRouter"), "sk-or-new-0000");
    await userEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PUT");
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string);
      expect(body.modelId).toBe("openai/gpt-4o");
      expect(body.apiKey).toBe("sk-or-new-0000");
      expect((put![1] as RequestInit).headers).toMatchObject({ "x-actor-name": "منى" });
    });
  });

  it("runs the connection test and shows the result message", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const u = String(urlArg);
      if (u.endsWith("/test")) {
        return { ok: true, json: async () => ({ ok: true, message: "تم الاتصال بنجاح." }) };
      }
      return {
        ok: true,
        json: async () => ({ modelId: "m", maskedKey: "", hasKey: false, lastTestedAt: null }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<LlmSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "اختبار الاتصال" }));
    expect(await screen.findByText("تم الاتصال بنجاح.")).toBeInTheDocument();
  });
});
