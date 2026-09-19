/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Google Drive integration's OAuth Client ID — a one-time setup step in
  // Google Cloud Console the user has to do themselves (see README.md).
  // Empty by default; the feature is inert (not broken, not hidden) until
  // it's set.
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
