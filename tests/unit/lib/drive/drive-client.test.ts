import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BACKUP_FILE_NAME,
  DriveApiError,
  downloadBackupFile,
  findBackupFileId,
  uploadBackupFile,
} from "@/lib/drive/drive-client";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findBackupFileId", () => {
  it("returns the first matching file's id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ files: [{ id: "file-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await findBackupFileId("token")).toBe("file-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(encodeURIComponent(BACKUP_FILE_NAME));
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
  });

  it("returns null when no file exists yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ files: [] })),
    );
    expect(await findBackupFileId("token")).toBeNull();
  });

  it("throws DriveApiError on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, false, 401)),
    );
    await expect(findBackupFileId("token")).rejects.toThrow(DriveApiError);
  });
});

describe("uploadBackupFile", () => {
  it("POSTs with file metadata when there is no existing file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "new-file" }));
    vi.stubGlobal("fetch", fetchMock);

    const id = await uploadBackupFile("token", "{}", null);

    expect(id).toBe("new-file");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).not.toContain("new-file");
    expect(String(init.body)).toContain(BACKUP_FILE_NAME);
  });

  it("PATCHes the existing file id without re-sending metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "existing-file" }));
    vi.stubGlobal("fetch", fetchMock);

    const id = await uploadBackupFile("token", '{"a":1}', "existing-file");

    expect(id).toBe("existing-file");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(url).toContain("existing-file");
    expect(String(init.body)).toContain('{"a":1}');
  });

  it("throws DriveApiError on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, false, 500)),
    );
    await expect(uploadBackupFile("token", "{}", null)).rejects.toThrow(
      DriveApiError,
    );
  });
});

describe("downloadBackupFile", () => {
  it("returns the file's raw text content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"app":"routines"}'),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const content = await downloadBackupFile("token", "file-1");

    expect(content).toBe('{"app":"routines"}');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("file-1");
    expect(url).toContain("alt=media");
  });

  it("throws DriveApiError on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, false, 404)),
    );
    await expect(downloadBackupFile("token", "missing")).rejects.toThrow(
      DriveApiError,
    );
  });
});
