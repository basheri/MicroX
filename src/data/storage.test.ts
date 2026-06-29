import { describe, it, expect, vi } from "vitest";
import {
  createSignedUrl,
  uploadProgramFile,
  PROGRAM_FILES_BUCKET,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
} from "@/data/storage";

// A minimal fake Supabase client so the signed-URL/upload helpers are testable
// without a live Supabase project (SEC-007: private bucket, short-lived signed URLs).
function fakeClient(behaviour: {
  signed?: { data: { signedUrl: string } | null; error: { message: string } | null };
  upload?: { data: unknown; error: { message: string } | null };
}) {
  const createSignedUrlSpy = vi.fn(async () => behaviour.signed ?? { data: null, error: null });
  const uploadSpy = vi.fn(async () => behaviour.upload ?? { data: {}, error: null });
  const from = vi.fn(() => ({ createSignedUrl: createSignedUrlSpy, upload: uploadSpy }));
  return { client: { storage: { from } }, from, createSignedUrlSpy, uploadSpy };
}

describe("storage signed URLs (rule 00 / SEC-007)", () => {
  it("creates a short-lived signed URL against the private bucket", async () => {
    const f = fakeClient({
      signed: { data: { signedUrl: "https://x/signed?token=abc" }, error: null },
    });
    const url = await createSignedUrl("programs/p1/file.pdf", undefined, f.client);

    expect(url).toBe("https://x/signed?token=abc");
    expect(f.from).toHaveBeenCalledWith(PROGRAM_FILES_BUCKET);
    expect(f.createSignedUrlSpy).toHaveBeenCalledWith(
      "programs/p1/file.pdf",
      DEFAULT_SIGNED_URL_TTL_SECONDS,
    );
  });

  it("uses the requested TTL when provided", async () => {
    const f = fakeClient({ signed: { data: { signedUrl: "u" }, error: null } });
    await createSignedUrl("a/b.pdf", 60, f.client);
    expect(f.createSignedUrlSpy).toHaveBeenCalledWith("a/b.pdf", 60);
  });

  it("throws when Supabase returns an error", async () => {
    const f = fakeClient({ signed: { data: null, error: { message: "denied" } } });
    await expect(createSignedUrl("a/b.pdf", 60, f.client)).rejects.toThrow(/denied/);
  });

  it("uploads to the private bucket without upsert", async () => {
    const f = fakeClient({ upload: { data: {}, error: null } });
    await uploadProgramFile("a/b.pdf", new Uint8Array([1, 2, 3]), "application/pdf", f.client);
    expect(f.from).toHaveBeenCalledWith(PROGRAM_FILES_BUCKET);
    expect(f.uploadSpy).toHaveBeenCalledWith("a/b.pdf", expect.any(Uint8Array), {
      contentType: "application/pdf",
      upsert: false,
    });
  });
});
