import css from "styled-jsx/css";

export const buttonStyles = css`
/* Button — quiet until lit. Only the primary carries color: flat cobalt. */

.tw-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-ui);
  font-weight: 600;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition:
    background var(--dur-1) var(--ease-out),
    border-color var(--dur-1) var(--ease-out),
    color var(--dur-1) var(--ease-out),
    filter var(--dur-1) var(--ease-out);
}

.tw-btn--sm { height: 26px; padding: 0 9px; font-size: var(--text-sm); border-radius: var(--r-sm); }
.tw-btn--md { height: 32px; padding: 0 13px; font-size: var(--text-md); }
.tw-btn--lg { height: 38px; padding: 0 18px; font-size: var(--text-lg); }

.tw-btn--primary {
  background: var(--action);
  color: var(--accent-ink);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16);
}
.tw-btn--primary:hover { background: var(--action-strong); }
.tw-btn--primary:active { filter: brightness(0.94); }

.tw-btn--secondary {
  background: var(--surface);
  border-color: var(--line-strong);
  color: var(--ink);
}
.tw-btn--secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tw-btn--secondary:active { background: var(--bg-band); }

.tw-btn--ghost {
  background: transparent;
  color: var(--accent);
}
.tw-btn--ghost:hover { background: var(--accent-soft-bg); }

.tw-btn--danger {
  background: transparent;
  border-color: color-mix(in srgb, var(--danger-ink) 40%, transparent);
  color: var(--danger-ink);
}
.tw-btn--danger:hover { background: var(--danger-bg); }

.tw-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: none;
}
.tw-btn:disabled:hover {
  background: unset;
  border-color: unset;
  color: unset;
}
.tw-btn--primary:disabled { background: var(--action); color: var(--accent-ink); }
.tw-btn--secondary:disabled { border-color: var(--line-strong); color: var(--ink); }
.tw-btn--ghost:disabled { color: var(--accent); }
`;
