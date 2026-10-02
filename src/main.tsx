import "@/app/globals.css";
import "@maat-apps/ui/font";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing #root element to mount the app into.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
