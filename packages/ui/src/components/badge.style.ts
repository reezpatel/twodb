import css from "styled-jsx/css";

export const badgeStyles = css`
  /* Badge — a small lit pill, tracked like a cue label.
   md pairs with the small button (26px), lg with the medium (32px). */

  .tw-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--r-pill);
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tw-badge--sm {
    height: 20px;
    padding: 0 7px;
    font-size: 10.5px;
  }
  .tw-badge--lg {
    height: 32px;
    padding: 0 13px;
    font-size: var(--text-sm);
  }

  .tw-badge--neutral {
    background: var(--bg-band-strong);
    color: var(--ink-2);
  }
  .tw-badge--go {
    background: var(--go-bg);
    color: var(--go);
  }
  .tw-badge--rose {
    background: var(--rose-soft-bg);
    color: var(--rose-accent);
  }
  .tw-badge--warning {
    background: var(--warning-bg);
    color: var(--warning-ink);
  }
  .tw-badge--danger {
    background: var(--danger-bg);
    color: var(--danger-ink);
  }
`;
