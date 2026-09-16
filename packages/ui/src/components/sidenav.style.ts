import css from "styled-jsx/css";

export const sidenavStyles = css`
/* SideNav — full-height edge panel over the overlay backdrop */

.tw-sidenav {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  box-shadow: var(--shadow-overlay);
}

.tw-sidenav--right {
  right: 0;
  border-left: 1px solid var(--line-strong);
  animation: tw-sidenav-in-right var(--dur-3) var(--ease-out) both;
}

.tw-sidenav--left {
  left: 0;
  border-right: 1px solid var(--line-strong);
  animation: tw-sidenav-in-left var(--dur-3) var(--ease-out) both;
}

.tw-sidenav--sm { width: min(320px, 100vw); }
.tw-sidenav--md { width: min(420px, 100vw); }
.tw-sidenav--lg { width: min(560px, 100vw); }

@keyframes tw-sidenav-in-right {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes tw-sidenav-in-left {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.tw-sidenav__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.tw-sidenav__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 650;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tw-sidenav__close {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--dur-1) var(--ease-out),
    color var(--dur-1) var(--ease-out);
}

.tw-sidenav__close:hover {
  background: var(--bg-band-strong);
  color: var(--ink);
}

.tw-sidenav__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  color: var(--ink-2);
}

.tw-sidenav__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}
`;
