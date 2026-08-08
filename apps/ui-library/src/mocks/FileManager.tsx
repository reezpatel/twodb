import { useState } from "react";
import {
  Button,
  FileTree,
  IconButton,
  Menu,
  MenuItem,
  type FileTreeNode,
} from "@twodb/ui";
import {
  FileText,
  FilePlus2,
  FolderPlus,
  Image as ImageIcon,
  Braces,
  Search,
  Upload,
} from "lucide-react";

const TREE: FileTreeNode[] = [
  {
    id: "sources",
    label: "Project sources",
    children: [
      { id: "src-files", label: "Source files" },
      { id: "src-exports", label: "Exports" },
    ],
  },
  {
    id: "inspiration",
    label: "Design inspiration",
    children: [
      { id: "product", label: "Product design", count: 4 },
      { id: "branding", label: "Branding" },
      { id: "digital-art", label: "Digital art" },
    ],
  },
  {
    id: "foundation",
    label: "UX Design Foundation",
    children: [
      { id: "research", label: "Research" },
      { id: "wires", label: "Wireframes" },
    ],
  },
  { id: "neu", label: "NEU documents" },
];

const FOLDER_FILES: Record<string, { name: string; meta: string; icon: "doc" | "img" | "code" }[]> = {
  product: [
    { name: "hero-v3.fig", meta: "FIG · 12 MB · Today", icon: "doc" },
    { name: "tokens.json", meta: "JSON · 18 KB · Yesterday", icon: "code" },
    { name: "cover.png", meta: "PNG · 2.4 MB · Aug 5", icon: "img" },
    { name: "notes.md", meta: "MD · 4 KB · Aug 3", icon: "doc" },
  ],
  branding: [
    { name: "logo-final.svg", meta: "SVG · 96 KB · Jul 28", icon: "img" },
    { name: "brand-guide.pdf", meta: "PDF · 8.1 MB · Jul 20", icon: "doc" },
  ],
  "digital-art": [{ name: "textures.zip", meta: "ZIP · 340 MB · Jul 12", icon: "doc" }],
  "src-files": [{ name: "app.tsx", meta: "TSX · 42 KB · Today", icon: "code" }],
  "src-exports": [{ name: "bundle.zip", meta: "ZIP · 18 MB · Aug 1", icon: "doc" }],
  research: [{ name: "interviews.md", meta: "MD · 22 KB · Jun 30", icon: "doc" }],
  wires: [{ name: "flows-v2.fig", meta: "FIG · 6 MB · Jul 8", icon: "doc" }],
  neu: [{ name: "readme.pdf", meta: "PDF · 1 MB · May 14", icon: "doc" }],
};

const FILE_ICONS = {
  doc: FileText,
  img: ImageIcon,
  code: Braces,
};

export function FileManagerMock() {
  const [selected, setSelected] = useState("product");
  const files = FOLDER_FILES[selected] ?? [];
  const selectedLabel = findLabel(TREE, selected);

  return (
    <div className="mock-fm">
      <aside className="mock-fm__side">
        <div className="mock-fm__head">
          <h3>File manager</h3>
          <IconButton label="Search files" icon={<Search />} />
        </div>
        <Menu
          placement="bottom-start"
          trigger={
            <Button className="mock-fm__create">
              <FolderPlus size={15} aria-hidden="true" />
              Create new
            </Button>
          }
        >
          <MenuItem icon={<FolderPlus />}>New folder</MenuItem>
          <MenuItem icon={<FilePlus2 />}>New document</MenuItem>
          <MenuItem icon={<Upload />}>Upload file</MenuItem>
        </Menu>
        <span className="tw-cue">Folder</span>
        <FileTree
          nodes={TREE}
          selected={selected}
          onSelect={setSelected}
          defaultExpanded={["inspiration"]}
          aria-label="Folders"
        />
      </aside>

      <section className="mock-fm__content">
        <h4>{selectedLabel}</h4>
        {files.length ? (
          <div className="mock-fm__grid">
            {files.map((f) => {
              const Icon = FILE_ICONS[f.icon];
              return (
                <div key={f.name} className="mock-fm__file">
                  <span className="mock-fm__file-icon">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <strong>{f.name}</strong>
                  <span className="mock-fm__file-meta tw-tnum">{f.meta}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mock-fm__empty">This folder is empty.</p>
        )}
      </section>
    </div>
  );
}

function findLabel(nodes: FileTreeNode[], id: string): string {
  for (const n of nodes) {
    if (n.id === id) return n.label;
    if (n.children) {
      const hit = findLabel(n.children, id);
      if (hit) return hit;
    }
  }
  return "Files";
}
