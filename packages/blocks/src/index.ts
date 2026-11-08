// UI primitives
export { Button, buttonVariants, type ButtonProps } from "./components/ui/button/button";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./components/ui/card/card";
export { Chip, chipVariants, CHIP_ZONES, CHIP_TONES } from "./components/ui/chip/chip";
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog/dialog";
export { Checkbox } from "./components/ui/form/checkbox";
export { Input } from "./components/ui/form/input";
export { Label } from "./components/ui/form/label";
export { RadioGroup, RadioGroupItem } from "./components/ui/form/radio-group";
export { Switch } from "./components/ui/form/switch";
export { Textarea } from "./components/ui/form/textarea";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs/tabs";

// App shell
export { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent } from "./components/appshell/shell/shell";
export { IconRail, IconRailSpacer, IconRailItem } from "./components/appshell/nav/icon-rail";
export { NavItem, NavSection } from "./components/appshell/nav/nav-item";
export { NavSidebar } from "./components/appshell/nav/nav-sidebar";
export { NavSidebarToggle } from "./components/appshell/nav/nav-sidebar-toggle";
export { WorkspaceSwitcher } from "./components/appshell/nav/workspace-switcher";
export { Sidebar, SidebarHeader, SidebarContent, SidebarSection } from "./components/appshell/sidebar/sidebar";
export { StatusBar, StatusBarGroup, StatusBarItem, statusBarVariants } from "./components/appshell/status-bar/status-bar";
// Chrome-like tab strip (closable/reorderable) — aliased to avoid clashing with ui Tabs.
export { Tabs as TabStrip, type TabData, type TabsProps as TabStripProps } from "./components/appshell/tabs/tabs";

// AI code chat
export { AgentWorkflow, ThinkingState, NestedReasoningBlock, CodeBlock, TerminalCommand, FileDiff, StreamingText, Markdown, PixelDotsLoader, highlightCode, DEFAULT_TOOL_REGISTRY } from "./components/ai-code/ai-agent-response";
export type { TraceNode, TraceNodeType, DetailLine, ToolDefinition, AgentPhase, DiffRow } from "./components/ai-code/ai-agent-response";
export { FolderTree, type FolderNode, type FolderTreeProps } from "./components/ai-code/folder-tree";
export { CanvasSidebar, type CanvasSidebarProps } from "./components/ai-code/canvas-sidebar";
export { ThinkingBlock, type ThinkingBlockProps } from "./components/ai-code/thinking-block";
export { ModelPicker, type ModelPickerProps, type ModelProvider, type ModelEntry } from "./components/ai-code/model-picker";
export { MessageQueue, type MessageQueueProps, type QueuedMessage } from "./components/ai-code/message-queue";
export {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputActions,
  PromptInputAttach,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputModelSelect,
  PromptInputSubmit,
  PromptInputHint,
  type PromptInputProps,
  type PromptAttachment,
  type PromptInputModel,
} from "./components/ai-code/prompt-input";
