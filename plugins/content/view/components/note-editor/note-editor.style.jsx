import css from "styled-jsx/css";

export const noteEditorStyles = css`
  .note-editor {
    grid-column: 3;
    grid-row: 1 / 3;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  .note-editor__chrome {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    flex: none;
    min-width: 0;
    padding: 0 8px 0 16px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .note-editor__doctype {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .note-editor__doctypeicon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: var(--r-sm);
    background: var(--shell-green-bg);
    color: var(--shell-green);
  }

  .note-editor__slug {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-editor__chromespacer {
    flex: 1;
  }

  .note-editor__barbtn--star.is-active {
    color: var(--shell-amber);
  }

  .note-editor__statusdot {
    width: 9px;
    height: 9px;
    flex: none;
    border-radius: 50%;
    background: var(--line-strong);
    margin: 0 2px;
  }

  .note-editor__statusdot.is-completed {
    background: var(--shell-green);
  }

  .note-editor__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .note-editor__body::-webkit-scrollbar {
    width: 8px;
  }

  .note-editor__body::-webkit-scrollbar-thumb {
    background: var(--line-strong);
    border-radius: var(--r-pill);
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .note-editor__doctitle {
    margin: 0 0 22px;
    font-family:
      "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    font-size: 31px;
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.15;
    color: var(--ink);
  }

  .note-editor__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  .note-editor__empty p {
    margin: 0;
  }
`;
