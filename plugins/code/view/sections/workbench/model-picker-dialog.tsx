import { Button, Dialog } from "@twodb/ui";
import type { LlmConnectionOption } from "../../lib/api";
import { Check } from "lucide-react";

export function ModelPickerDialog({
  open,
  onClose,
  connections,
  connectionId,
  onPick,
  model,
  onPickModel,
  models,
}: {
  open: boolean;
  onClose: () => void;
  connections: LlmConnectionOption[];
  connectionId: string | null;
  onPick: (connectionId: string | null) => void;
  model: string | null;
  onPickModel: (model: string | null) => void;
  models: Array<{ id: string; display_name: string }>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Model"
      footer={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 320 }}>
        <button
          type="button"
          className={`code-chat__switch-option${connectionId === null ? " is-selected" : ""}`}
          onClick={() => {
            onPick(null);
            onClose();
          }}
        >
          <span className="code-chat__switch-option-label">Workspace default</span>
          <span className="code-chat__switch-option-hint">The default model configured in workspace settings</span>
          {connectionId === null ? <Check size={14} aria-hidden="true" /> : null}
        </button>
        {connections.map((connection) => (
          <button
            key={connection.id}
            type="button"
            className={`code-chat__switch-option${connectionId === connection.id ? " is-selected" : ""}`}
            disabled={!connection.enabled}
            onClick={() => {
              onPick(connection.id);
              onClose();
            }}
          >
            <span className="code-chat__switch-option-label">{connection.name}</span>
            <span className="code-chat__switch-option-hint">{connection.enabled ? connection.provider : "disabled"}</span>
            {connectionId === connection.id ? <Check size={14} aria-hidden="true" /> : null}
          </button>
        ))}
        {connections.length === 0 ? (
          <p style={{ color: "var(--ink-3)", fontSize: "var(--text-sm)", margin: 0 }}>
            No connections yet — add one under Settings → LLM Providers.
          </p>
        ) : null}

        {models.length > 0 ? (
          <>
            <p
              style={{
                margin: "var(--space-3) 0 0",
                fontSize: "var(--text-sm)",
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Model
            </p>
            <button
              type="button"
              className={`code-chat__switch-option${model === null ? " is-selected" : ""}`}
              onClick={() => {
                onPickModel(null);
                onClose();
              }}
            >
              <span className="code-chat__switch-option-label">Provider default</span>
              <span className="code-chat__switch-option-hint">Resolved by the connection / workspace default</span>
              {model === null ? <Check size={14} aria-hidden="true" /> : null}
            </button>
            {models.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`code-chat__switch-option${model === entry.id ? " is-selected" : ""}`}
                onClick={() => {
                  onPickModel(entry.id);
                  onClose();
                }}
              >
                <span className="code-chat__switch-option-label">{entry.display_name || entry.id}</span>
                <span className="code-chat__switch-option-hint">{entry.id}</span>
                {model === entry.id ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            ))}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
