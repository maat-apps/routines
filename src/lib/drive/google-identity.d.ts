// Minimal ambient types for the slice of Google Identity Services this app
// uses (the OAuth token client) — not the full @types/google.accounts
// surface, which this app has no use for otherwise.
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
            }) => void;
            error_callback?: (error: {
              type?: string;
              message?: string;
            }) => void;
          }): { requestAccessToken: () => void };
        };
      };
    };
  }
}
