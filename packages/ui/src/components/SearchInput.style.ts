import css from "styled-jsx/css";

export const searchInputStyles = css`
	.tw-search {
		position: relative;
		display: block;
	}

	.tw-search > :global(svg) {
		position: absolute;
		left: 11px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		color: var(--ink-3);
		pointer-events: none;
	}

	.tw-search > .tw-input {
		width: 100%;
		padding-left: 33px;
	}
`;
