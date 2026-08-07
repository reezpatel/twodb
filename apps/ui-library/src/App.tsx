import { useState } from "react";
import { registry } from "./registry";

export default function App() {
  const [selected, setSelected] = useState(registry[0].name);
  const entry = registry.find((c) => c.name === selected)!;

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="sidebar__brand">twodb UI</h1>
        <nav>
          {registry.map((c) => (
            <button
              key={c.name}
              className={
                c.name === selected ? "sidebar__item sidebar__item--active" : "sidebar__item"
              }
              onClick={() => setSelected(c.name)}
            >
              {c.name}
            </button>
          ))}
        </nav>
      </aside>

      <main className="canvas">
        <header className="canvas__header">
          <h2>{entry.name}</h2>
          <p>{entry.description}</p>
        </header>

        {entry.stories.map((story) => (
          <section key={story.title} className="story">
            <h3 className="story__title">{story.title}</h3>
            <div className="story__preview">{story.render()}</div>
            <pre className="story__code">
              <code>{story.code}</code>
            </pre>
          </section>
        ))}
      </main>
    </div>
  );
}
