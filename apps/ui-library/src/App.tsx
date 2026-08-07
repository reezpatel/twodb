import { useState, type CSSProperties } from "react";
import { Tabs } from "@twodb/ui";
import { registry } from "./registry";

export default function App() {
  const [selected, setSelected] = useState(registry[0].id);
  const [phase, setPhase] = useState<"day" | "night">("day");

  const entry = registry.find((c) => c.id === selected) ?? registry[0];
  const cueNumber = String(registry.indexOf(entry)).padStart(2, "0");

  const groups = ["Foundation", "Primitives"] as const;

  return (
    <div className="shell">
      <aside className="rail" data-phase="night">
        <div className="rail__brand">
          <span className="rail__wordmark">twodb</span>
          <span className="rail__sub">Design System</span>
        </div>
        <nav className="rail__nav">
          {groups.map((group) => (
            <div key={group} className="rail__group">
              <span className="rail__group-label">{group}</span>
              {registry
                .filter((c) => c.group === group)
                .map((c) => {
                  const num = String(registry.indexOf(c)).padStart(2, "0");
                  const active = c.id === selected;
                  return (
                    <button
                      key={c.id}
                      className={active ? "rail__item rail__item--active" : "rail__item"}
                      onClick={() => setSelected(c.id)}
                    >
                      <span className="rail__cue tw-tnum">{num}</span>
                      <span>{c.name}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="canvas" data-phase={phase}>
        <header className="canvas__header band" style={{ "--i": 0 } as CSSProperties}>
          <div className="canvas__title-row">
            <span className="canvas__cue tw-tnum">{cueNumber}</span>
            <h1>{entry.name}</h1>
            <div className="canvas__phase">
              <Tabs
                aria-label="Canvas phase"
                value={phase}
                onValueChange={(v) => setPhase(v as "day" | "night")}
                items={[
                  { id: "day", label: "Day" },
                  { id: "night", label: "Night" },
                ]}
              />
            </div>
          </div>
          <p className="canvas__desc">{entry.description}</p>
        </header>

        {entry.stories.map((story, i) => (
          <section
            key={story.title}
            className="story band"
            style={{ "--i": i + 1 } as CSSProperties}
          >
            <h2 className="story__title">{story.title}</h2>
            <div className="story__preview">{story.render()}</div>
            {story.code ? (
              <pre className="story__code">
                <code>{story.code}</code>
              </pre>
            ) : null}
          </section>
        ))}
      </main>
    </div>
  );
}
