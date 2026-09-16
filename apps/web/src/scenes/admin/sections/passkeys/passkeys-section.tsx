import { Badge, Button, EmptyState, IconButton, Skeleton } from "@twodb/ui";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { usePasskeys } from "../../hooks/use-passkeys";
import { AdminApiError } from "../../lib/admin-api";
import { passkeysSectionStyles } from "./passkeys-section.style";

export function PasskeysSection() {
  const { passkeysQuery, registerPasskey, deletePasskey } = usePasskeys();
  const passkeys = passkeysQuery.data ?? [];
  const hasMultiplePasskeys = passkeys.length > 1;
  const deleteError = deletePasskey.error;

  return (
    <section className="passkeys-page">
      <style jsx>{passkeysSectionStyles}</style>
      <header className="passkeys-page__header">
        <div>
          <h1>Passkeys</h1>
          <p>
            Passkeys are the only way in. At least one must exist at all times.
          </p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          disabled={registerPasskey.isPending}
          onClick={() => registerPasskey.mutate(undefined)}
        >
          <Plus aria-hidden="true" size={16} />
          {registerPasskey.isPending ? "Adding…" : "New passkey"}
        </Button>
      </header>

      {registerPasskey.error ? (
        <p className="passkeys-page__error" role="alert">
          {registerPasskey.error.message}
        </p>
      ) : null}
      {deleteError ? (
        <p className="passkeys-page__error" role="alert">
          {deleteError instanceof AdminApiError &&
          deleteError.code === "last_passkey"
            ? "Can't delete the last passkey — one passkey must always exist."
            : deleteError.message}
        </p>
      ) : null}

      <div className="passkeys-page__list-section">
        {passkeysQuery.isPending ? (
          <div
            className="passkeys-page__list passkeys-page__list--loading"
            aria-label="Loading passkeys"
          >
            {Array.from({ length: 2 }, (_, index) => (
              <div className="passkeys-page__loading-row" key={index}>
                <Skeleton width={40} height={40} />
                <div>
                  <Skeleton width={180} />
                  <Skeleton width={260} />
                </div>
              </div>
            ))}
          </div>
        ) : passkeys.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            iconTone="accent"
            title="No passkeys registered"
            description="Add a passkey to secure access to this instance."
            action={
              <Button
                variant="secondary"
                disabled={registerPasskey.isPending}
                onClick={() => registerPasskey.mutate(undefined)}
              >
                <Plus aria-hidden="true" />
                Add passkey
              </Button>
            }
          />
        ) : (
          <ul className="passkeys-page__list">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="passkeys-page__row">
                <div className="passkeys-page__key-icon" aria-hidden="true">
                  <KeyRound />
                </div>
                <div className="passkeys-page__row-main">
                  <div className="passkeys-page__row-title">
                    <strong>{passkey.name || "Unnamed passkey"}</strong>
                    {hasMultiplePasskeys ? null : (
                      <Badge size="sm">Required</Badge>
                    )}
                  </div>
                  <div className="passkeys-page__meta">
                    <span>
                      Added{" "}
                      <time dateTime={passkey.created_at}>
                        {new Date(passkey.created_at).toLocaleDateString()}
                      </time>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {passkey.last_used_at ? (
                        <>
                          Last used{" "}
                          <time dateTime={passkey.last_used_at}>
                            {new Date(passkey.last_used_at).toLocaleString()}
                          </time>
                        </>
                      ) : (
                        "Never used"
                      )}
                    </span>
                  </div>
                </div>
                <IconButton
                  label={
                    hasMultiplePasskeys
                      ? `Delete ${passkey.name || "passkey"}`
                      : "The only passkey cannot be deleted"
                  }
                  icon={<Trash2 />}
                  disabled={deletePasskey.isPending || !hasMultiplePasskeys}
                  onClick={() => deletePasskey.mutate(passkey.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
