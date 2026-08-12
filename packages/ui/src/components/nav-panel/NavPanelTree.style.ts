import css from "styled-jsx/css";

export const navPanelTreeStyles = css`
  .tw-navpanel-treewrap {
    margin-bottom: var(--space-1);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree) {
    outline: none;
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree:focus-visible) {
    border-radius: var(--r-sm);
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node) {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding-right: var(--space-2);
    padding-left: calc(var(--space-1) + (var(--tw-navpanel-tree-depth) * 2px));
    padding-top: 4px;
    padding-bottom: 4px;
    border-radius: var(--r-sm);
    color: var(--ink-2);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    transition:
      background var(--dur-1) var(--ease-out),
      color var(--dur-1) var(--ease-out),
      opacity var(--dur-1) var(--ease-out);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node:hover),
  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.will-receive-drop) {
    background: var(--bg-band);
    color: var(--ink);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-active),
  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-active:hover) {
    background: var(--accent-soft-bg);
    color: var(--accent);
    font-weight: 500;
  }

  :global([data-phase="night"]) .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-active) {
    background: color-mix(in srgb, var(--surface) 94%, var(--ink) 6%);
    color: var(--ink);
  }

  :global([data-phase="night"]) .tw-navpanel-treewrap :global(.tw-navpanel-tree__node:hover),
  :global([data-phase="night"]) .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.will-receive-drop),
  :global([data-phase="night"]) .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-active:hover) {
    background: color-mix(in srgb, var(--surface) 88%, var(--ink) 12%);
    color: var(--ink);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-dragging) {
    opacity: 0.48;
    cursor: grabbing;
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__toggle) {
    display: grid;
    place-items: center;
    width: 15px;
    height: 15px;
    flex: none;
    border: 0;
    border-radius: var(--r-sm);
    padding: 0;
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
    transition:
      background var(--dur-1) var(--ease-out),
      color var(--dur-1) var(--ease-out),
      transform var(--dur-1) var(--ease-out);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__toggle:hover) {
    background: var(--bg-band-strong);
    color: var(--ink);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-open .tw-navpanel-tree__toggle) {
    transform: rotate(90deg);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__toggle--spacer),
  .tw-navpanel-treewrap :global(.tw-navpanel-tree__toggle--spacer:hover) {
    background: transparent;
    cursor: default;
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__icon) {
    display: grid;
    place-items: center;
    width: 15px;
    height: 15px;
    flex: none;
    color: var(--tw-navpanel-tree-icon-color, var(--ink-3));
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__icon svg) {
    width: 14px;
    height: 14px;
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__node.is-active .tw-navpanel-tree__toggle) {
    color: var(--accent);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__cursor) {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    display: flex;
    align-items: center;
    height: 2px;
    background: var(--accent);
    border-radius: var(--r-pill);
  }

  .tw-navpanel-treewrap :global(.tw-navpanel-tree__cursor span) {
    width: 5px;
    height: 5px;
    margin-left: -1px;
    border-radius: var(--r-pill);
    background: var(--accent);
  }
`;
