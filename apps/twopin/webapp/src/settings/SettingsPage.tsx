import { Button } from "@twodb/blocks";
import { usePageHeader } from "../shell/usePageHeader.js";
import { useTwoPin } from "../state/TwoPinProvider.js";
import { useSettings } from "./hooks/useSettings.js";

/** Settings page: pick the default board used by the share target. */
export function SettingsPage() {
  const { boards } = useTwoPin();
  const state = useSettings();

  usePageHeader({ title: "Settings" });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="flex flex-col gap-2 rounded-xl border border-outline bg-paper p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">Share target</h2>
          <p className="text-xs text-ink-muted">
            Links shared to TwoPin from other apps are saved to this board.
          </p>
          {state.loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void state.save(state.defaultBoardId);
              }}
            >
              <select
                className="h-9 rounded-md border border-outline bg-paper px-3 text-sm text-ink"
                value={state.defaultBoardId ?? ""}
                onChange={(e) => state.setDefaultBoardId(e.target.value || null)}
                disabled={state.saving}
              >
                <option value="">First board (default)</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
              {state.saved && <p className="text-sm text-ink-muted">Saved.</p>}
              <div>
                <Button type="submit" disabled={state.saving}>
                  {state.saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

