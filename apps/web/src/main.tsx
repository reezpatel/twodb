import "@twodb/ui/styles.css"; // the ONLY ui-css import in the repo (see plan.md §6)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import "./index.css";

// The shell renders standalone for now. Plugin boot (react-pluggable store,
// core bus/api/shell plugins, the view-plugin registry) lands when the first
// view plugin is wired into this frame — see plan.md.
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<BrowserRouter>
			<AppShell />
		</BrowserRouter>
	</StrictMode>,
);
