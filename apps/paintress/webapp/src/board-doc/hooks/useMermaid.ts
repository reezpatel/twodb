import { useEffect, useState } from "react";

let seq = 0;

/** Business hook: render one Mermaid source to SVG (lazy-loads mermaid, strict security level). */
export function useMermaid(source: string) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
        const { svg } = await mermaid.render(`pa-mermaid-${++seq}`, source);
        if (alive) {
          setSvg(svg);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message.split("\n")[0] ?? "Invalid diagram");
        document.getElementById(`dpa-mermaid-${seq}`)?.remove(); // mermaid leaves an error node behind
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [source]);
  return { svg, error };
}
