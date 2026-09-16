import css from "styled-jsx/css";

export const providerTemplatePickerStyles = css`
	.template-picker {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-3);
	}

	.template-picker__card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--surface);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition:
			border-color var(--dur-1) var(--ease-out),
			background var(--dur-1) var(--ease-out);
	}

	.template-picker__card:hover {
		border-color: var(--accent);
		background: var(--accent-soft-bg);
	}

	.template-picker__label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink);
	}

	.template-picker__id {
		font-size: var(--text-xxs);
		font-family: var(--font-mono);
		color: var(--ink-3);
	}

	.template-picker__badges {
		display: flex;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
`;
