import css from "styled-jsx/css";

export const dialogStyles = css`
  .tw-dialog {
    width: min(440px, calc(100vw - 32px));
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-lg);
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-overlay);
    overflow: visible;
  }

  .tw-dialog::backdrop {
    background: rgb(5 5 6 / 0.45);
  }

  .tw-dialog[open] {
    animation: tw-dialog-in var(--dur-3) var(--ease-out) both;
  }

  @keyframes tw-dialog-in {
    from {
      opacity: 0;
      transform: translateY(10px);
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: none;
      filter: none;
    }
  }

  .tw-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5) 0;
  }

  .tw-dialog__title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 500;
  }

  .tw-dialog__close {
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
    transition:
      background var(--dur-1) var(--ease-out),
      color var(--dur-1) var(--ease-out);
  }

  .tw-dialog__close:hover {
    background: var(--bg-band-strong);
    color: var(--ink);
  }

  .tw-dialog__body {
    max-height: calc(100dvh - 220px);
    padding: var(--space-3) var(--space-5);
    overflow-y: auto;
    color: var(--ink-2);
    font-size: var(--text-md);
  }

  .tw-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5) var(--space-4);
  }
`;
