import css from "styled-jsx/css";

export const loadingGridStyles = css`
	.plugins-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.plugins-card--loading {
		min-height: 252px;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background: var(--surface);
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
