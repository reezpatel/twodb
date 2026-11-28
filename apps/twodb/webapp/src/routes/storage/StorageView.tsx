import { Button } from "@twodb/blocks";
import { ArrowUp, ChevronRight, Download, Folder, HardDrive, RefreshCw, Trash2, Upload } from "lucide-react";
import { useStorage } from "./hooks/useStorage.js";
import { PaneHeader } from "../shell/partials/PaneHeader.js";
import { formatDate } from "../../lib/format.js";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes;
  let u = -1;
  do {
    v /= 1024;
    u += 1;
  } while (v >= 1024 && u < units.length - 1);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`;
}

/** Storage explorer — browses the install's shared S3 bucket (each app's blobs live under its `<slug>/` prefix). */
export function StorageView() {
  const s = useStorage();

  const uploadButton = (
    <>
      <input ref={s.uploadInputRef} type="file" multiple hidden onChange={(e) => void s.upload(e.target.files)} />
      <Button size="sm" disabled={s.busy || !s.info?.configured} onClick={() => s.uploadInputRef.current?.click()}>
        <Upload className="size-4" />
        Upload
      </Button>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <PaneHeader
        title="Storage"
        description={
          s.info?.configured
            ? `Bucket ${s.info.bucket}${s.info.endpoint ? ` · ${s.info.endpoint}` : ""}${s.info?.region ? ` · ${s.info.region}` : ""}`
            : "S3 is not configured — set TWODB_S3_* on the control plane"
        }
        action={uploadButton}
      />

      {s.error ? (
        <p role="alert" className="mb-4 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {s.error}
        </p>
      ) : null}

      {!s.info?.configured && !s.loading ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <HardDrive className="size-8" />
          <p className="text-sm">
            Apps get a prefix-scoped slice of the shared bucket once <code className="font-mono">TWODB_S3_*</code> is set.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline bg-card shadow-[0_1px_2px_rgba(0,0,0,.025)]">
          {/* Path bar */}
          <div className="flex items-center gap-1 border-b border-outline bg-stone/70 px-4 py-2 text-[12px] text-ink-muted">
            <button type="button" onClick={() => s.openPrefix("")} className="font-medium text-ink hover:underline">
              {s.listing?.bucket ?? "…"}
            </button>
            {s.prefix
              .split("/")
              .filter(Boolean)
              .map((seg, i, all) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="size-3.5" />
                  <button type="button" onClick={() => s.openPrefix(all.slice(0, i + 1).join("/"))} className="font-medium text-ink hover:underline">
                    {seg}
                  </button>
                </span>
              ))}
            <span className="ml-auto flex items-center gap-2">
              {s.listing?.truncated ? <span title="Listing truncated at 1000 objects">truncated</span> : null}
              <button type="button" onClick={s.refresh} aria-label="Refresh" className="text-ink-muted hover:text-ink">
                <RefreshCw className={s.loading ? "size-3.5 animate-spin" : "size-3.5"} />
              </button>
            </span>
          </div>

          {s.loading && !s.listing ? (
            <p className="py-10 text-center text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <tbody className="divide-y divide-outline">
                {s.prefix ? (
                  <tr className="text-[12px] hover:bg-stone/50">
                    <td colSpan={4} className="h-10 px-4 py-0 align-middle">
                      <button type="button" onClick={s.up} className="flex items-center gap-2.5 text-ink">
                        <ArrowUp className="size-4 text-ink-muted" />
                        ..
                      </button>
                    </td>
                  </tr>
                ) : null}
                {(s.listing?.folders ?? []).map((f) => (
                  <tr key={f} className="group text-[12px] hover:bg-stone/50">
                    <td colSpan={3} className="h-10 px-4 py-0 align-middle font-medium whitespace-nowrap text-ink">
                      <button
                        type="button"
                        onClick={() => s.openPrefix(s.prefix ? `${s.prefix}/${f}` : f)}
                        className="flex items-center gap-2.5"
                      >
                        <Folder className="size-4 text-ink-muted" />
                        {f}
                      </button>
                    </td>
                    <td className="h-10 w-28 px-4 py-0 align-middle" />
                  </tr>
                ))}
                {(s.listing?.objects ?? []).map((o) => (
                  <tr key={o.key} className="group text-[12px] hover:bg-stone/50">
                    <td className="h-10 px-4 py-0 align-middle font-medium break-all text-ink">{o.name}</td>
                    <td className="h-10 w-24 px-4 py-0 align-middle whitespace-nowrap text-ink-muted">{formatSize(o.size)}</td>
                    <td className="h-10 w-40 px-4 py-0 align-middle whitespace-nowrap text-ink-muted">{formatDate(o.lastModified)}</td>
                    <td className="h-10 w-28 px-4 py-0 align-middle">
                      <span className="flex items-center justify-end gap-1">
                        {s.confirmingKey === o.key ? (
                          <>
                            <Button size="sm" variant="danger" disabled={s.busy} onClick={() => void s.confirmDelete(o.key)}>
                              Delete?
                            </Button>
                            <Button size="sm" variant="ghost" disabled={s.busy} onClick={s.cancelDelete}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => s.download(o.key)} aria-label={`Download ${o.name}`} className="text-ink-muted hover:text-ink">
                              <Download className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => s.startDelete(o.key)}
                              aria-label={`Delete ${o.name}`}
                              className="text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
                {!s.loading && (s.listing?.folders.length ?? 0) === 0 && (s.listing?.objects.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-muted-foreground">
                      Empty — upload a file, or head into an app's prefix.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

