import { Button, Dialog } from "@twodb/ui";
import type { PluginsSectionState } from "./plugins-section.types";
import { pluginDetailDialogStyles } from "./plugin-detail-dialog.style";

export function PluginDetailDialog({ state }: { state: PluginsSectionState }) {
  const plugin = state.detailPlugin;

  return (
    <Dialog
      open={plugin !== null}
      onClose={state.closeDetail}
      title={plugin ? plugin.manifest?.name || plugin.identifier : undefined}
      footer={
        plugin?.connected ? (
          <>
            <Button variant="secondary" onClick={state.closeDetail}>
              Close
            </Button>
            <Button variant="danger" disabled={state.pendingIdentifier !== null} onClick={() => state.removeIntegration(plugin.identifier)}>
              {state.pendingIdentifier === plugin.identifier ? "Removing…" : "Remove"}
            </Button>
          </>
        ) : undefined
      }
    >
      <style jsx>{pluginDetailDialogStyles}</style>
      {plugin ? (
        <div className="plugins-detail">
          <p className="plugins-detail__description">{plugin.manifest?.description}</p>
          {(() => {
            const Settings = state.settingsFor(plugin.manifest?.identifier ?? "");
            if (!Settings) return null;
            return (
              <div className="plugins-detail__settings">
                <Settings
                  config={plugin.config ?? {}}
                  setConfig={async (data) => {
                    try {
                      await state.updatePluginConfig(plugin.identifier, data);
                      return { success: true };
                    } catch (err) {
                      return { success: false, errors: [err instanceof Error ? err.message : String(err)] };
                    }
                  }}
                />
              </div>
            );
          })()}
        </div>
      ) : null}
    </Dialog>
  );
}
