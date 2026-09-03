import css from "styled-jsx/css";

export const resizableStyles = css`
  .tw-resizable {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .tw-resizable--horizontal {
    flex-direction: row;
  }

  .tw-resizable--vertical {
    flex-direction: column;
  }

  .tw-resizable__panel {
    overflow: hidden;
  }

  .tw-resizable__handle {
    flex: none;
    position: relative;
    background: transparent;
    outline: none;
    touch-action: none;
  }

  .tw-resizable--horizontal > .tw-resizable__handle {
    width: 7px;
    margin: 0 -3px;
    cursor: col-resize;
  }

  .tw-resizable--vertical > .tw-resizable__handle {
    height: 7px;
    margin: -3px 0;
    cursor: row-resize;
  }

  /* the visible seam, drawn centered on the hit area */
  .tw-resizable__handle::after {
    content: "";
    position: absolute;
    background: var(--line);
    transition: background var(--dur-1) var(--ease-out);
  }

  .tw-resizable--horizontal > .tw-resizable__handle::after {
    top: 0;
    bottom: 0;
    left: 3px;
    width: 1px;
  }

  .tw-resizable--vertical > .tw-resizable__handle::after {
    left: 0;
    right: 0;
    top: 3px;
    height: 1px;
  }

  .tw-resizable__handle:hover::after,
  .tw-resizable__handle:focus-visible::after,
  .tw-resizable__handle:active::after {
    background: var(--accent);
  }
`;
