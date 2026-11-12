import { useDrive } from "./hooks/useDrive.js";
import { DriveSidebar } from "./partials/DriveSidebar.js";
import { FilesScene } from "./partials/FilesScene.js";
import { TrashScene } from "./partials/TrashScene.js";
import { SettingsScene } from "./partials/SettingsScene.js";

/**
 * Holding component: renders the sidebar (backends → virtual storages tree,
 * plus trash/settings) and the active scene. Each scene gets its state from
 * useDrive; partials stay dumb.
 */
export function DrivePage() {
  const { view } = useDrive();

  return (
    <div className="flex h-full min-h-0">
      <DriveSidebar />
      <div className="min-w-0 flex-1 overflow-hidden">
        {view === "files" && <FilesScene />}
        {view === "trash" && <TrashScene />}
        {view === "settings" && <SettingsScene />}
      </div>
    </div>
  );
}
