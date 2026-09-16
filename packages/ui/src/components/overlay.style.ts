import css from "styled-jsx/css";

export const overlayRootStyles = css`
/* Overlay — portal root: dimmed stage under any floating layer */

.tw-overlay-root {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
}

.tw-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(5 5 6 / 0.45);
  animation: tw-overlay-in var(--dur-2) var(--ease-out) both;
}

@keyframes tw-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
`;

export const overlayStyles = css`
/* Tooltip — a console readout: always night, always brief */

.tw-tip {
  position: relative;
  display: inline-flex;
}

.tw-tip::after {
  content: attr(data-tip);
  position: absolute;
  z-index: var(--z-tooltip);
  padding: 5px 10px;
  border-radius: var(--r-sm);
  background: var(--twdb-night);
  color: #f4f3f8;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 500;
  letter-spacing: 0.01em;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--dur-1) var(--ease-out),
    transform var(--dur-1) var(--ease-out);
}

.tw-tip--top::after {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(2px);
}

.tw-tip--top:hover::after,
.tw-tip--top:focus-within::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  transition-delay: var(--tip-delay, 0s);
}

.tw-tip--right::after {
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(-2px);
}

.tw-tip--right:hover::after,
.tw-tip--right:focus-within::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
  transition-delay: var(--tip-delay, 0s);
}

/* Menu — an anchored popup of lit rows on a matte panel */

.tw-menu-anchor {
  position: relative;
  display: inline-flex;
}

.tw-menu {
  position: absolute;
  z-index: var(--z-overlay);
  min-width: 184px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-overlay);
  animation: tw-menu-in var(--dur-2) var(--ease-out) both;
}

.tw-menu--bottom-start { top: calc(100% + 6px); left: 0; }
.tw-menu--bottom-end { top: calc(100% + 6px); right: 0; }
.tw-menu--top-start { bottom: calc(100% + 6px); left: 0; }
.tw-menu--top-end { bottom: calc(100% + 6px); right: 0; }

@keyframes tw-menu-in {
  from {
    opacity: 0;
    transform: translateY(4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

.tw-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-md);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-1) var(--ease-out);
}

.tw-menu__item :global(svg) {
  width: 15px;
  height: 15px;
  color: var(--ink-3);
  flex-shrink: 0;
}

.tw-menu__item:hover {
  background: var(--bg-band-strong);
}

.tw-menu__item--danger {
  color: var(--danger-ink);
}

.tw-menu__item--danger :global(svg) {
  color: var(--danger-ink);
}

.tw-menu__item--danger:hover {
  background: var(--danger-bg);
}

.tw-menu__divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--line);
}
`;
