import css from "styled-jsx/css";

export const catalogContentStyles = css`
	.plugins-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
	}

	@media (max-width: 1100px) {
		.plugins-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.plugins-grid {
			grid-template-columns: 1fr;
		}
	}
`;
