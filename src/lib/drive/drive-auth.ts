// One-click "Connect Google Drive" via Google Identity Services' OAuth
// token client — no gapi SDK (heavier, and this app only ever needs a
// handful of REST calls, see drive-client.ts). The script loads on demand,
// the first time a Drive action is actually used, not eagerly on app boot —
// same "opt-in, not bundled by default" posture as the rest of this
// feature.
//
// Important limitation, not a bug: this app has no backend, so it can only
// use GIS's implicit token flow, which never issues a refresh token — every
// access token expires in about an hour and there is no way to silently
// renew it client-side. "Connected" is therefore per-action, not a
// persisted state: every sync/restore call requests a fresh token (Google
// usually reuses prior consent silently once already granted, so this is
// normally an invisible round-trip, not a repeat consent screen). The token
// itself is kept in memory only — see requestDriveAccessToken — never
// localStorage, since it's a bearer credential, not app data.

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
// drive.file — this app can only ever see/modify files it itself created,
// never the rest of the user's Drive. The least-privilege scope for what a
// single-file backup sync needs.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export class DriveAuthError extends Error {}

let gisLoad: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new DriveAuthError("Not running in a browser."));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  gisLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoad = null;
      reject(new DriveAuthError("Could not load Google Identity Services."));
    };
    document.head.append(script);
  });
  return gisLoad;
}

/**
 * Prompts the user to connect their Google account (a real popup/consent
 * screen the first time, usually silent afterward) and resolves to a
 * short-lived access token scoped to drive.file. Never persisted by this
 * function or any caller — the token lives only as long as the caller
 * keeps it in a variable.
 */
export async function requestDriveAccessToken(
  clientId: string,
): Promise<string> {
  if (!clientId) {
    throw new DriveAuthError("Google Drive is not configured for this app.");
  }
  await loadGoogleIdentityServices();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) {
    throw new DriveAuthError("Google Identity Services failed to load.");
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new DriveAuthError(
              response.error ?? "Google did not return an access token.",
            ),
          );
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new DriveAuthError(
            error.message ?? error.type ?? "Google sign-in was cancelled.",
          ),
        );
      },
    });
    client.requestAccessToken();
  });
}
