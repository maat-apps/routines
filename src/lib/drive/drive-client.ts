// Thin wrapper over the Google Drive REST v3 API — no gapi SDK, just fetch,
// since this app only ever needs three calls against one file. Every
// function here is pure request/response shaping (given a token and some
// input, return a value or throw) so it's unit-testable by mocking fetch,
// unlike drive-auth.ts's actual OAuth popup.

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

// One well-known filename, overwritten in place (see uploadBackupFile) —
// never a second, timestamped copy. drive.file scope means this app can
// only ever see files it created itself, so searching by name here can't
// collide with anything else in the user's Drive.
export const BACKUP_FILE_NAME = "routines-backup.json";

export class DriveApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function driveFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new DriveApiError(0, "Could not reach Google Drive.");
  }
  if (!response.ok) {
    let message = `Google Drive request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // Body wasn't JSON (or already consumed) — keep the generic message.
    }
    throw new DriveApiError(response.status, message);
  }
  return response;
}

/**
 * The backup file's id, if this app has already created one. Ordered by
 * most-recently-modified so that if a race ever produces a duplicate (two
 * devices creating the file at once — see drive-sync.ts), every client
 * converges on the newest one instead of an arbitrary pick.
 */
export async function findBackupFileId(
  accessToken: string,
): Promise<string | null> {
  const query = encodeURIComponent(
    `name = '${BACKUP_FILE_NAME}' and trashed = false`,
  );
  const orderBy = encodeURIComponent("modifiedTime desc");
  const response = await driveFetch(
    `${DRIVE_FILES_URL}?q=${query}&fields=files(id,modifiedTime)&spaces=drive&orderBy=${orderBy}`,
    accessToken,
  );
  const data = (await response.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

/**
 * Overwrites the existing backup file (save-by-overwrite, not a new
 * versioned copy), or creates it the first time. Returns the file id either
 * way, so the caller can remember it for next time.
 */
export async function uploadBackupFile(
  accessToken: string,
  content: string,
  existingFileId: string | null,
): Promise<string> {
  const boundary = "routines-backup";
  const metadata = existingFileId
    ? {}
    : { name: BACKUP_FILE_NAME, mimeType: "application/json" };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const url = existingFileId
    ? `${DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

  const response = await driveFetch(url, accessToken, {
    method: existingFileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = (await response.json()) as { id: string };
  return data.id;
}

/** The backup file's raw JSON text — parsed/validated by the caller. */
export async function downloadBackupFile(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const response = await driveFetch(
    `${DRIVE_FILES_URL}/${fileId}?alt=media`,
    accessToken,
  );
  return response.text();
}
