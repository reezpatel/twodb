const SKIP = /^(diff |index |--- |\+\+\+ |\\ No newline)/;

export function DiffView({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="font-mono text-xs">
      {lines.map((line, i) => {
        if (!line || SKIP.test(line)) return null;
        if (line.startsWith("@@")) {
          return (
            <div key={i} className="bg-muted text-muted-foreground px-3 py-1 whitespace-pre">
              {line}
            </div>
          );
        }
        if (line.startsWith("+")) {
          return (
            <div key={i} className="bg-success/10 px-3 text-success whitespace-pre">
              {line}
            </div>
          );
        }
        if (line.startsWith("-")) {
          return (
            <div key={i} className="bg-destructive/10 px-3 text-destructive whitespace-pre">
              {line}
            </div>
          );
        }
        return (
          <div key={i} className="text-muted-foreground px-3 whitespace-pre">
            {line}
          </div>
        );
      })}
    </div>
  );
}
