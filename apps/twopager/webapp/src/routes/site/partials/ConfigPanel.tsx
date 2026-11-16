import { useEffect, useState } from "react";
import { Button, Textarea } from "@twodb/blocks";
import type { VersionDetail } from "../../../lib/types";
import { Section } from "../../../components/Ui";

const EXAMPLE = `{
  "spa": true,
  "cleanUrls": true,
  "redirects": [{ "source": "/old/:slug", "destination": "/blog/:slug", "type": 301 }],
  "rewrites": [{ "source": "/app/**", "destination": "/index.html" }],
  "headers": [{ "source": "**/*.js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }]
}`;

interface Props {
  version: VersionDetail | undefined;
  isDraft: boolean;
  onSave: (config: unknown) => void;
}

export function ConfigPanel({ version, isDraft, onSave }: Props) {
  const [text, setText] = useState("{}");
  const [err, setErr] = useState("");
  useEffect(() => { setText(JSON.stringify(version?.config ?? {}, null, 2)); setErr(""); }, [version?.id, version?.config]);
  if (!version) return <Section title="Rewrite rules"><p className="text-sm text-ink-muted">Select a version first.</p></Section>;
  const save = () => { try { onSave(JSON.parse(text)); setErr(""); } catch { setErr("Not valid JSON"); } };
  return (
    <Section title={`Rewrite rules — v${version.number}`}>
      <Textarea className="h-64 font-mono text-xs" value={text} readOnly={!isDraft} onChange={(e) => setText(e.target.value)} aria-label="Version config" />
      {err ? <p className="mt-1 text-sm text-destructive">{err}</p> : null}
      {isDraft ? <Button className="mt-2" onClick={save}>Save config</Button> : <p className="mt-2 text-xs text-ink-muted">Released versions are immutable — edit a copy to change rules.</p>}
      <details className="mt-4 text-xs text-ink-muted">
        <summary className="cursor-pointer">Reference</summary>
        <p className="my-2">Order: redirects → static file → rewrites → 404 page. Sources are globs: <code>**</code> any depth, <code>*</code> one segment part, <code>:name</code> a named segment, <code>{"{a,b}"}</code> alternatives. <code>spa</code> adds a catch-all rewrite to <code>/index.html</code>. You can also ship this as <code>twopager.json</code> at the root of a zip.</p>
        <pre className="overflow-auto rounded-md bg-stone p-3">{EXAMPLE}</pre>
      </details>
    </Section>
  );
}
