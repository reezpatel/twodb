import { useState } from "react";
import { FileText, GitBranch, Layers, MessageSquare, Settings, Wand2 } from "lucide-react";
import { ribbonStyles } from "./ribbon.style";

const RAIL_ITEMS = [
  { id: "files", icon: FileText },
  { id: "issues", icon: MessageSquare },
  { id: "ai", icon: Wand2 },
  { id: "settings", icon: Settings },
];

const RAIL_BOTTOM = [
  { id: "git", icon: GitBranch },
  { id: "layers", icon: Layers },
];

export function Ribbon() {
  const [active, setActive] = useState("issues");

  return (
    <nav className="code-ribbon" aria-label="Code tools">
      <style jsx>{ribbonStyles}</style>
      {RAIL_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`code-ribbon__item${active === item.id ? " is-active" : ""}`}
          onClick={() => setActive(item.id)}
          aria-label={item.id}
          aria-pressed={active === item.id}
        >
          <item.icon size={18} aria-hidden="true" />
        </button>
      ))}
      <div className="code-ribbon__spacer" />
      {RAIL_BOTTOM.map((item) => (
        <button key={item.id} type="button" className="code-ribbon__item" aria-label={item.id}>
          <item.icon size={18} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
