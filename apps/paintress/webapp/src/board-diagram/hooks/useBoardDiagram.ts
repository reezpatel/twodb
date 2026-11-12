import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyEdgeChanges, applyNodeChanges, useReactFlow, type Edge, type EdgeChange, type Node, type NodeChange } from "@xyflow/react";
import { actorKind, type Board, type Item } from "@shared/model";
import { applyEvent, type ItemMap } from "../../lib/item-store";
import { toFlowEdges, toFlowNodes } from "../../lib/flow-graph";
import { useBoardSocket } from "../../board/hooks/useBoardSocket";
import { useAgentActivity } from "./useAgentActivity";
import { useDiagramCommands } from "./useDiagramCommands";
import { useHistory } from "./useHistory";
import { useShortcuts } from "./useShortcuts";
import { useToast } from "./useToast";

export type Tool = "select" | "hand";

/** Holding hook for DiagramCanvas: board state, live sync, React Flow wiring, commands. */
export function useBoardDiagram(boardId: string) {
  const rf = useReactFlow();
  const [items, setItemsState] = useState<ItemMap>(new Map());
  const itemsRef = useRef<ItemMap>(items);
  const setItems = useCallback((fn: (m: ItemMap) => ItemMap) => {
    itemsRef.current = fn(itemsRef.current);
    setItemsState(itemsRef.current);
  }, []);
  const [board, setBoard] = useState<Board | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [presence, setPresence] = useState<{ actor: string; kind: "human" | "agent" }[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const history = useHistory();
  const toast = useToast();
  const activity = useAgentActivity();
  const clientRef = useRef("");
  const firstFit = useRef(true);

  const socket = useBoardSocket(boardId, {
    onSnapshot: (m) => {
      setItems(() => new Map(m.items.map((i) => [i.id, i])));
      setBoard(m.board);
      setLoaded(true);
      history.clear();
    },
    onEvents: ({ events }) => {
      for (const ev of events) {
        // Our own batches are already on screen (optimistic); only others' changes need applying.
        if (ev.origin === clientRef.current) continue;
        setItems((m) => applyEvent(m, ev));
        if (actorKind(ev.actor) === "agent") {
          // AI edits join the human's undo stack, so Ctrl+Z reverts them.
          history.record({ label: ev.label ?? "AI change", ops: ev.inverse });
          activity.flashIds(ev.upserts.map((i) => i.id));
          toast.notify(ev.label ?? "An agent changed the board");
        }
      }
    },
    onPresence: (m) => setPresence(m.actors),
    onError: (code, message) => toast.notify(`${code}: ${message}`),
  });
  clientRef.current = socket.clientId;
  const canEdit = socket.status === "open" && loaded;

  const cmd = useDiagramCommands({
    boardId,
    itemsRef,
    setItems,
    sendOps: socket.sendOps,
    history,
    canEdit,
    notify: toast.notify,
    resync: socket.resync,
    toFlow: rf.screenToFlowPosition,
  });

  // items → React Flow (keeps selection and in-flight drags)
  useEffect(() => {
    setNodes((prev) => toFlowNodes(items, prev, activity.flash));
    setEdges((prev) => toFlowEdges(items, prev));
  }, [items, activity.flash]);

  useEffect(() => {
    if (loaded && firstFit.current && nodes.length) {
      firstFit.current = false;
      setTimeout(() => void rf.fitView({ padding: 0.2, duration: 200 }), 60);
    }
  }, [loaded, nodes.length, rf]);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((ns) => applyNodeChanges(c, ns)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((es) => applyEdgeChanges(c, es)), []);

  const selectedIds = useMemo(() => [...nodes.filter((n) => n.selected).map((n) => n.id), ...edges.filter((e) => e.selected).map((e) => e.id)], [nodes, edges]);
  const selectedItem: Item | null = selectedIds.length === 1 ? (items.get(selectedIds[0]!) ?? null) : null;

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/paintress");
      if (!raw) return;
      const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const p = JSON.parse(raw) as { kind: string; pack?: string; shape?: string; style?: string; icon?: string; label?: string };
      if (p.kind === "shape") cmd.addShape(p.pack!, p.shape!, at);
      else if (p.kind === "group") cmd.addGroup(p.style!, at);
      else if (p.kind === "icon") cmd.addIcon(p.icon!, p.label!, at);
      else if (p.kind === "entity") cmd.addEntity(at);
      else if (p.kind === "sticky") cmd.addSticky(at);
      else if (p.kind === "text") cmd.addText(at);
      else if (p.kind === "pool") cmd.addPool(at);
    },
    [rf, cmd],
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  useShortcuts({
    undo: () => void cmd.undo(),
    redo: () => void cmd.redo(),
    remove: () => cmd.deleteIds(selectedIds),
    duplicate: () => cmd.duplicate(selectedIds),
    copy: () => cmd.copy(selectedIds),
    paste: cmd.paste,
    fit: () => void rf.fitView({ padding: 0.2, duration: 200 }),
    selectTool: () => setTool("select"),
    handTool: () => setTool("hand"),
    addSticky: () => cmd.addSticky(),
    addText: () => cmd.addText(),
    addRectangle: () => cmd.addShape("basic", "rectangle"),
    addEllipse: () => cmd.addShape("basic", "ellipse"),
    addGroup: () => cmd.addGroup("plain"),
  });

  const actions = useMemo(() => ({ canEdit, patch: cmd.patch, resized: cmd.resized }), [canEdit, cmd.patch, cmd.resized]);

  return {
    board,
    loaded,
    status: socket.status,
    canEdit,
    presence,
    tool,
    setTool,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onDrop,
    onDragOver,
    selectedIds,
    selectedItem,
    history,
    toast,
    cmd,
    actions,
    fit: () => void rf.fitView({ padding: 0.2, duration: 200 }),
  };
}
