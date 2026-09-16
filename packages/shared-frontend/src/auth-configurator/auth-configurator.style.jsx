import css from "styled-jsx/css";

export const authConfiguratorStyles = css`
	.provider-auth {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 420px;
	}

	.provider-auth__oauth {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
	}

	.provider-auth__oauth-link {
		color: var(--accent-ink);
		font-size: var(--text-sm);
		font-weight: 500;
		text-decoration: none;
	}

	.provider-auth__hint {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}

	.provider-auth__hint a {
		color: var(--accent-ink);
	}

	.provider-auth__actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-3);
	}

	.provider-auth__verify-ok {
		font-size: var(--text-sm);
		color: var(--go-ink, var(--accent-ink));
	}

	.provider-auth__verify-error {
		font-size: var(--text-sm);
		color: var(--danger-ink);
	}
`;
