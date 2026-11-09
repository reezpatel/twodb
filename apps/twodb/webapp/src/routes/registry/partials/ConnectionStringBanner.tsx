export interface ConnectionStringBannerProps {
  slug: string;
  connectionString: string;
  onDismiss: () => void;
}

/** Dumb/presentational only — shown once right after provisioning, since the credential is never shown again. */
export function ConnectionStringBanner(props: ConnectionStringBannerProps) {
  return (
    <div role="alert" className="twodb-connstr-banner">
      <strong>{props.slug}</strong> provisioned. Copy this connection string into its deployment env now — it
      will not be shown again:
      <pre>
        <code>{props.connectionString}</code>
      </pre>
      <button type="button" onClick={props.onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
