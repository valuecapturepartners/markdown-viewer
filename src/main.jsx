import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import "./styles/editor.css";
import "./styles/capture.css";
import "./styles/preview.css";
import "./styles/criticmarkup.css";
import "./styles/toolbar.css";
import "./styles/kanban.css";
import "./styles/mobile.css";
import App from "./App.jsx";
import { registerSW } from "./pwa/register-sw.js";

registerSW();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
