import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isShareTargetRequest,
  receiveSharedBackup,
  SHARE_TARGET_FIELD,
  takeSharedBackup,
} from "@/lib/shared-backup";

const BASE = "/routines/";
const ORIGIN = "https://example.test";

// jsdom has no Cache API; a Map keyed by URL is all shared-backup.ts uses.
function fakeCaches() {
  const entries = new Map<string, Response>();
  const cache = {
    put: vi.fn(async (url: string, response: Response) => {
      entries.set(url, response);
    }),
    match: vi.fn(async (url: string) => entries.get(url)),
    delete: vi.fn(async (url: string) => entries.delete(url)),
  };
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  return entries;
}

// A stand-in rather than a real Request: jsdom's FormData isn't one the
// runtime's Request would serialise as multipart.
function shareRequest(body: FormData, path = `${BASE}share-target`) {
  return {
    method: "POST",
    url: `${ORIGIN}${path}`,
    formData: async () => body,
  } as unknown as Request;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isShareTargetRequest", () => {
  it("matches a POST to the share target path", () => {
    expect(isShareTargetRequest(shareRequest(new FormData()), BASE)).toBe(true);
  });

  it("ignores a GET to the same path", () => {
    const request = {
      method: "GET",
      url: `${ORIGIN}${BASE}share-target`,
    } as Request;
    expect(isShareTargetRequest(request, BASE)).toBe(false);
  });

  it("ignores a POST elsewhere", () => {
    const request = shareRequest(new FormData(), `${BASE}other`);
    expect(isShareTargetRequest(request, BASE)).toBe(false);
  });
});

describe("receiveSharedBackup / takeSharedBackup", () => {
  let entries: Map<string, Response>;

  beforeEach(() => {
    entries = fakeCaches();
  });

  it("parks the shared file and redirects home with the marker", async () => {
    const body = new FormData();
    body.append(
      SHARE_TARGET_FIELD,
      new File(['{"app":"routines"}'], "routines-backup.txt", {
        type: "text/plain",
      }),
    );

    const response = await receiveSharedBackup(shareRequest(body), BASE);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `${ORIGIN}${BASE}?shared-backup`,
    );
    expect(await takeSharedBackup(BASE)).toBe('{"app":"routines"}');
  });

  it("offers a shared file only once", async () => {
    entries.set(`${BASE}shared-backup`, new Response("backup"));

    expect(await takeSharedBackup(BASE)).toBe("backup");
    expect(await takeSharedBackup(BASE)).toBeNull();
  });

  it("still redirects when the share carries no file", async () => {
    const body = new FormData();
    body.append(SHARE_TARGET_FIELD, "not a file");

    const response = await receiveSharedBackup(shareRequest(body), BASE);

    expect(response.status).toBe(303);
    expect(entries.size).toBe(0);
  });
});

describe("takeSharedBackup", () => {
  it("returns null without the Cache API", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await takeSharedBackup(BASE)).toBeNull();
  });

  it("defaults to the app's base URL", async () => {
    const entries = fakeCaches();
    entries.set(`${import.meta.env.BASE_URL}shared-backup`, new Response("x"));
    expect(await takeSharedBackup()).toBe("x");
  });
});
