import css from "styled-jsx/css";

export const integrationCardStyles = css`
	.plugins-card {
		min-width: 0;
		min-height: 252px;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background: var(--surface);
		overflow: hidden;
		transition: border-color var(--dur-1) var(--ease-out);
	}

	.plugins-card:hover {
		border-color: var(--line-strong);
	}

	.plugins-card__body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
	}

	.plugins-card__identity {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		min-width: 0;
	}

	.plugins-card__identity > div {
		min-width: 0;
	}

	.plugins-card__identity h2 {
		margin: 0 0 2px;
		font-size: var(--text-lg);
		font-weight: 650;
		line-height: 1.25;
		color: var(--ink);
	}

	.plugins-card__identity p {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-3);
	}

	.plugins-card__identity img {
		width: 64px;
		height: 64px;
		flex: 0 0 64px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--bg-band);
		object-fit: cover;
	}

	.plugins-card__description {
		margin: 0;
		color: var(--ink-2);
		line-height: 1.5;
	}

	.plugins-card__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: 62px;
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--line);
	}

	.plugins-card__meta,
	.plugins-card__actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.plugins-card__meta span:not(:first-child) {
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}

	@media (max-width: 520px) {
		.plugins-card__footer {
			align-items: flex-start;
			flex-direction: column;
		}

		.plugins-card__actions {
			width: 100%;
			justify-content: space-between;
		}
	}
`;
