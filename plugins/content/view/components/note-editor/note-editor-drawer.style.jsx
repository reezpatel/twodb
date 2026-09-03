import css from "styled-jsx/css";

export const noteEditorDrawerStyles = css`
  .note-editor-drawer {
    position: fixed;
    inset: 0;
    z-index: 60;
    pointer-events: none;
  }

  .note-editor-drawer__backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: transparent;
    pointer-events: auto;
    cursor: default;
  }

  .note-editor-drawer__panel {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: min(540px, calc(100vw - 260px));
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.22);
    overflow: hidden;
    pointer-events: auto;
    animation: note-editor-drawer-in 180ms ease-out;
  }

  .note-editor-drawer__panel :global(.note-editor) {
    flex: 1;
    min-height: 0;
  }

  .note-editor-drawer__close {
    position: absolute;
    top: 7px;
    right: 8px;
    z-index: 2;
  }

  @keyframes note-editor-drawer-in {
    from {
      transform: translateX(24px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
