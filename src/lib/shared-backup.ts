// Web Share Target: an installed Routines shows up in Android's share sheet
// (public/manifest.json's `share_target`), so a backup can be sent straight
// from a cloud drive app the file picker can't reach (e.g. Proton Drive).
// The share arrives as a POST the static host can't answer, so the service
// worker (src/sw.ts) parks the file in a cache and redirects home with
// `?shared-backup`, where the app takes it and asks before importing.

/** Under the app's base URL; must match `share_target.action`. */
export const SHARE_TARGET_PATH = "share-target";
/** Must match `share_target.params.files[0].name`. */
export const SHARE_TARGET_FIELD = "backup";
export const SHARED_BACKUP_PARAM = "shared-backup";

const CACHE_NAME = "routines-shared-backup";

function entryUrl(baseUrl: string): string {
  return `${baseUrl}${SHARED_BACKUP_PARAM}`;
}

export function isShareTargetRequest(
  request: Request,
  baseUrl: string,
): boolean {
  return (
    request.method === "POST" &&
    new URL(request.url).pathname === `${baseUrl}${SHARE_TARGET_PATH}`
  );
}

/** The service worker's answer to the share: park the file, go home. */
export async function receiveSharedBackup(
  request: Request,
  baseUrl: string,
): Promise<Response> {
  const file = (await request.formData()).get(SHARE_TARGET_FIELD);
  if (file !== null && typeof file !== "string") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(entryUrl(baseUrl), new Response(await file.text()));
  }
  return Response.redirect(
    new URL(`${baseUrl}?${SHARED_BACKUP_PARAM}`, request.url).href,
    303,
  );
}

/** The shared file's text, removed so it's offered only once; or null. */
export async function takeSharedBackup(
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(entryUrl(baseUrl));
  if (!response) return null;
  await cache.delete(entryUrl(baseUrl));
  return response.text();
}
