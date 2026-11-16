import { useState } from "react";
import { Button, Input } from "@twodb/blocks";
import { Section } from "../../../components/Ui";

interface Props {
  hosts: string[];
  domains: string[];
  onAdd: (host: string) => void;
  onRemove: (host: string) => void;
}

export function DomainsPanel({ hosts, domains, onAdd, onRemove }: Props) {
  const [host, setHost] = useState("");
  return (
    <Section title="Domains">
      <ul className="mb-4 space-y-1 text-sm">
        {hosts.map((h) => (
          <li key={h} className="flex items-center gap-2">
            <a className="underline-offset-2 hover:underline" href={`https://${h}`} target="_blank" rel="noreferrer">{h}</a>
            {domains.includes(h) ? <Button variant="ghost" onClick={() => { if (confirm(`Detach ${h}?`)) onRemove(h); }}>Remove</Button> : <span className="text-xs text-ink-muted">built-in</span>}
          </li>
        ))}
        {!hosts.length ? <li className="text-ink-muted">No domain attached — the site is not reachable yet.</li> : null}
      </ul>
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); const h = host.trim(); if (h) { onAdd(h); setHost(""); } }}>
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.example.com" aria-label="Custom domain" />
        <Button type="submit">Add domain</Button>
      </form>
      <p className="mt-3 text-xs text-ink-muted">Point the domain's DNS at your TwoDB gateway (and terminate TLS for it in front of the gateway). Requests for an attached domain are served from the live version.</p>
    </Section>
  );
}
