import { useEffect, useState, type CSSProperties } from "react";
import {
  AccountMenu,
  MenuDivider,
  MenuItem,
  NavPanel,
  NavRail,
  NavSection,
  SearchInput,
  Tabs,
} from "@twodb/ui";
import {
  CircleHelp,
  Component,
  LogOut,
  Palette,
  PanelLeft,
  Settings,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { registry } from "./registry";

const RAIL_GROUPS = [
  { id: "Foundation", icon: <Palette /> },
  { id: "Primitives", icon: <Component /> },
  { id: "Shell", icon: <PanelLeft /> },
];

export default function App() {
  const [group, setGroup] = useState<string>("Foundation");
  const [selected, setSelected] = useState(registry[0].id);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"day" | "night">("day");

  /* Phase lives on the document root: panel, canvas, grain, and
     popups all switch; the icon rail stays pinned to night. */
  useEffect(() => {
    document.documentElement.dataset.phase = phase;
  }, [phase]);

  const entry = registry.find((c) => c.id === selected) ?? registry[0];
  const cueNumber = String(registry.indexOf(entry)).padStart(2, "0");

  const q = query.trim().toLowerCase();
  const visible = q
    ? registry.filter((c) => c.name.toLowerCase().includes(q))
    : registry.filter((c) => c.group === group);

  function selectGroup(id: string) {
    setGroup(id);
    setQuery("");
    const first = registry.find((c) => c.group === id);
    if (first) setSelected(first.id);
  }

  return (
    <div className="shell">
      <NavRail
        aria-label="Library sections"
        header={<span className="shell-brand">T</span>}
        value={group}
        onValueChange={selectGroup}
        items={RAIL_GROUPS.map((g) => ({ id: g.id, icon: g.icon, label: g.id }))}
      />

      <NavPanel
        search={
          <SearchInput
            placeholder="Search components…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search components"
          />
        }
        footer={
          <>
            <NavSection
              items={[
                { id: "settings", label: "Settings", icon: <Settings /> },
                { id: "help", label: "Help & shortcuts", icon: <CircleHelp /> },
              ]}
            />
            <AccountMenu name="Asha Verma" sub="Design workspace">
              <MenuItem icon={<User />}>Profile</MenuItem>
              <MenuItem icon={<SlidersHorizontal />}>Preferences</MenuItem>
              <MenuDivider />
              <MenuItem icon={<LogOut />} danger>
                Log out
              </MenuItem>
            </AccountMenu>
          </>
        }
      >
        <NavSection
          label={q ? "Results" : group}
          items={visible.map((c) => ({ id: c.id, label: c.name }))}
          value={selected}
          onValueChange={setSelected}
        />
      </NavPanel>

      <main className="canvas">
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
