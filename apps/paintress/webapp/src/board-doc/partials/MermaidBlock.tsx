import { useMermaid } from "../hooks/useMermaid";

export function MermaidBlock({ source }: { source: string }) {
  const { svg, error } = useMermaid(source);
  if (error)
    return (
      <div className="my-3 rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-[12px]">
        <div className="mb-1 font-semibold text-destructive">Mermaid error: {error}</div>
        <pre className="overflow-auto whitespace-pre-wrap text-ink-muted">{source}</pre>
      </div>
    );
  if (!svg) return <div className="my-3 text-[12px] text-ink-muted">Rendering diagram…</div>;
  return <div className="pa-mermaid my-4 flex justify-center overflow-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
