import { useState } from "react";
import { Circle, Frame, Hand, MoreHorizontal, MousePointer2, PenTool, Shapes, Square, Sticker, StickyNote, Table2, Type, Workflow } from "lucide-react";
import { sameSpec, type ArmedSpec } from "./hooks/usePlacement";
import { useIconSearch } from "./hooks/useIconSearch";
import type { Tool } from "./hooks/useBoardDiagram";
import { DockButton } from "./partials/DockButton";
import { DockFlyout } from "./partials/DockFlyout";
import { DrawFlyout } from "./partials/DrawFlyout";
import { GroupList } from "./partials/GroupList";
import { IconGrid } from "./partials/IconGrid";
import { NotesFlyout } from "./partials/NotesFlyout";
import { OthersFlyout } from "./partials/OthersFlyout";
import { ShapeGrid } from "./partials/ShapeGrid";

type FlyoutId = "flow" | "shapes" | "notes" | "draw" | "stickers" | "frames" | "others";

const FLOW_PACK = ["flowchart"] as const;
const SHAPE_PACKS = ["basic", "bpmn", "c4"] as const;
const QUICK = ["basic:rectangle", "basic:ellipse"]; // square + circle live on the dock itself

/**
 * The left-edge tool dock (Miro-style pill): pointer/hand toggle, quick square
 * and circle, then flyouts for flow / shapes / notes / draw / stickers /
 * frames / others, plus direct-arm buttons for text and table.
 */
export function ToolDock(props: {
  tool: Tool;
  onTool(t: Tool): void;
  armed: ArmedSpec | null;
  arm(spec: ArmedSpec): void;
  addImage(file: File): void;
  disabled: boolean;
}) {
  const { armed, arm } = props;
  const [open, setOpen] = useState<FlyoutId | null>(null);
  const [shapePack, setShapePack] = useState<string>("basic");
  const search = useIconSearch(open === "stickers");

  const toggle = (id: FlyoutId) => setOpen((cur) => (cur === id ? null : id));
  const armAndClose = (spec: ArmedSpec) => {
    arm(spec);
    setOpen(null);
  };
  const pickTool = (t: Tool) => {
    props.onTool(t);
    setOpen(null);
  };

  const is = (spec: ArmedSpec) => sameSpec(armed, spec);
  const drawActive = props.tool === "pen" || props.tool === "highlighter" || props.tool === "eraser";

  return (
    <div className={`pa-dock absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-start gap-2 ${props.disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-outline bg-popover p-1.5 shadow-lg">
        <DockButton
          title={props.tool === "hand" ? "Hand tool — click for Select (V)" : "Select (V) — click for Hand (H)"}
          active={props.tool === "select" || props.tool === "hand"}
          onClick={() => props.onTool(props.tool === "hand" ? "select" : "hand")}
        >
          {props.tool === "hand" ? <Hand className="size-4" /> : <MousePointer2 className="size-4" />}
        </DockButton>
        <span className="my-0.5 h-px w-6 bg-outline" />

        <DockButton title="Rectangle (R)" active={is({ kind: "shape", pack: "basic", shape: "rectangle" })} onClick={() => armAndClose({ kind: "shape", pack: "basic", shape: "rectangle" })}>
          <Square className="size-4" />
        </DockButton>
        <DockButton title="Circle (O)" active={is({ kind: "shape", pack: "basic", shape: "ellipse" })} onClick={() => armAndClose({ kind: "shape", pack: "basic", shape: "ellipse" })}>
          <Circle className="size-4" />
        </DockButton>

        <DockButton title="Flowchart" flyout open={open === "flow"} onClick={() => toggle("flow")}>
          <Workflow className="size-4" />
        </DockButton>
        <DockButton title="Shapes" flyout open={open === "shapes"} onClick={() => toggle("shapes")}>
          <Shapes className="size-4" />
        </DockButton>
        <DockButton title="Sticky notes" flyout open={open === "notes"} active={armed?.kind === "sticky"} onClick={() => toggle("notes")}>
          <StickyNote className="size-4" />
        </DockButton>
        <DockButton title="Text (T)" active={is({ kind: "text" })} onClick={() => armAndClose({ kind: "text" })}>
          <Type className="size-4" />
        </DockButton>
        <DockButton title="Draw — pen, highlighter, eraser" flyout open={open === "draw"} active={drawActive} onClick={() => toggle("draw")}>
          <PenTool className="size-4" />
        </DockButton>
        <DockButton title="Stickers — icon catalogue" flyout open={open === "stickers"} active={armed?.kind === "icon"} onClick={() => toggle("stickers")}>
          <Sticker className="size-4" />
        </DockButton>
        <DockButton title="Frames — generic + cloud" flyout open={open === "frames"} active={armed?.kind === "group"} onClick={() => toggle("frames")}>
          <Frame className="size-4" />
        </DockButton>
        <DockButton title="Table (ERD entity)" active={is({ kind: "entity" })} onClick={() => armAndClose({ kind: "entity" })}>
          <Table2 className="size-4" />
        </DockButton>
        <DockButton title="More — swimlanes, image" flyout open={open === "others"} active={armed?.kind === "pool"} onClick={() => toggle("others")}>
          <MoreHorizontal className="size-4" />
        </DockButton>
      </div>

      {open === "flow" && (
        <DockFlyout title="Flowchart">
          <ShapeGrid pack="flowchart" onPack={() => {}} packs={FLOW_PACK} armed={armed} onArm={(pack, shape) => armAndClose({ kind: "shape", pack, shape })} />
        </DockFlyout>
      )}
      {open === "shapes" && (
        <DockFlyout title="Shapes">
          <ShapeGrid pack={shapePack} onPack={setShapePack} packs={SHAPE_PACKS} exclude={QUICK} armed={armed} onArm={(pack, shape) => armAndClose({ kind: "shape", pack, shape })} />
        </DockFlyout>
      )}
      {open === "notes" && (
        <DockFlyout title="Sticky notes">
          <NotesFlyout armed={armed} onArm={(color) => armAndClose({ kind: "sticky", color })} />
        </DockFlyout>
      )}
      {open === "draw" && (
        <DockFlyout title="Draw">
          <DrawFlyout tool={props.tool} onPick={pickTool} />
        </DockFlyout>
      )}
      {open === "stickers" && (
        <DockFlyout title="Stickers" wide>
          <IconGrid
            query={search.query}
            onQuery={search.setQuery}
            set={search.set}
            onSet={search.setSet}
            icons={search.icons}
            searching={search.searching}
            armed={armed}
            onArm={(i) => armAndClose({ kind: "icon", icon: i.id, label: i.name.replace(/^aws-/, "").replace(/-icon$/, "").replace(/[-_]/g, " ") })}
          />
        </DockFlyout>
      )}
      {open === "frames" && (
        <DockFlyout title="Frames">
          <GroupList armed={armed} onArm={(style) => armAndClose({ kind: "group", style })} />
        </DockFlyout>
      )}
      {open === "others" && (
        <DockFlyout title="More">
          <OthersFlyout armed={armed} onArm={armAndClose} addImage={props.addImage} />
        </DockFlyout>
      )}
    </div>
  );
}
