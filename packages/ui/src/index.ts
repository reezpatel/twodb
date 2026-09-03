/* Fonts: Outfit (UI/body) + IBM Plex Sans (cue labels, display caps) */
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import "./styles.css";

export { Button } from "./components/button";
export type {
	ButtonProps,
	ButtonVariant,
	ButtonSize,
} from "./components/button";

export { Input } from "./components/input";
export type { InputProps, InputSize } from "./components/input";

export { Textarea } from "./components/textarea";
export type { TextareaProps } from "./components/textarea";

export { Select } from "./components/select";
export type { SelectProps } from "./components/select";

export { Checkbox } from "./components/checkbox";
export type { CheckboxProps } from "./components/checkbox";

export { Checklist, CheckItem } from "./components/checklist";
export type {
	ChecklistProps,
	CheckItemProps,
	ChecklistPriority,
} from "./components/checklist";

export { Radio } from "./components/radio";
export type { RadioProps } from "./components/radio";

export { Switch } from "./components/switch";
export type { SwitchProps } from "./components/switch";

export { Badge } from "./components/badge";
export type { BadgeProps, BadgeTone, BadgeSize } from "./components/badge";

export { TagChip } from "./components/tag-chip";
export type { TagChipIcon, TagChipProps } from "./components/tag-chip";

export { Card } from "./components/card";
export type { CardDensity, CardProps, CardTone } from "./components/card";

export { Tabs } from "./components/tabs";
export type { TabsProps, TabItem } from "./components/tabs";

export { Segmented } from "./components/segmented";
export type { SegmentedProps, SegmentedItem } from "./components/segmented";

export { Dialog } from "./components/dialog";
export type { DialogProps } from "./components/dialog";

export { Avatar } from "./components/avatar";
export type {
	AvatarProps,
	AvatarSize,
	AvatarPresence,
} from "./components/avatar";

export { Divider } from "./components/divider";
export type { DividerProps } from "./components/divider";

export { Skeleton } from "./components/skeleton";
export type { SkeletonProps } from "./components/skeleton";

export { Tooltip } from "./components/tooltip";
export type { TooltipProps, TooltipSide } from "./components/tooltip";

export { Kbd } from "./components/kbd";
export type { KbdProps } from "./components/kbd";

export { IconButton } from "./components/icon-button";
export type {
	IconButtonProps,
	IconButtonVariant,
	IconButtonSize,
} from "./components/icon-button";

export { Menu, MenuItem, MenuDivider } from "./components/menu";
export type {
	MenuProps,
	MenuItemProps,
	MenuPlacement,
} from "./components/menu";

export { SearchInput } from "./components/search-input";
export type { SearchInputProps } from "./components/search-input";

export { NavRail } from "./components/nav-rail";
export type { NavRailProps, NavRailItem } from "./components/nav-rail";

export {
	NavPanel,
	NavPanelSection,
	NavPanelGroup,
	NavPanelItem,
	NavPanelCount,
	NavPanelBadge,
	NavPanelFooter,
	NavPanelTree,
} from "./components/nav-panel";
export type {
	NavPanelProps,
	NavPanelSectionProps,
	NavPanelGroupProps,
	NavPanelItemProps,
	NavPanelFooterProps,
	NavPanelTreeNode,
	NavPanelTreeProps,
} from "./components/nav-panel";

export { AccountMenu } from "./components/account-menu";
export type { AccountMenuProps } from "./components/account-menu";

export { Table, THead, TBody, TR, TH, TD } from "./components/table";
export type { THProps, TDProps } from "./components/table";

export { DataTable } from "./components/data-table";
export type {
	DataTableProps,
	DataColumn,
	FilterSpec,
	FilterRule,
} from "./components/data-table";

export { DataGantt } from "./components/data-gantt";
export type {
	DataGanttProps,
	DataGanttItem,
	DataGanttMeta,
	DataGanttMilestone,
} from "./components/data-gantt";

export { CellView, CellEditor } from "./components/cells";
export type { CellType, CellOption } from "./components/cells";

export { Calendar } from "./components/calendar";
export type { CalendarProps } from "./components/calendar";

export {
	DatePicker,
	DateRangePicker,
	DateTimePicker,
	TimePicker,
} from "./components/pickers";
export type {
	DatePickerProps,
	DateRangePickerProps,
	DateTimePickerProps,
	TimePickerProps,
} from "./components/pickers";
export type { DateRange } from "react-day-picker";

export {
	ChatPanel,
	ChatHeader,
	ChatList,
	MessageGroup,
	ChatMessage,
	TextMessage,
	ImageMessage,
	GalleryMessage,
	VideoMessage,
	AudioMessage,
	DocumentMessage,
	ChatComposer,
} from "./components/chat";
export type {
	ChatHeaderProps,
	ChatReaction,
	ChatAction,
	ChatReplyTo,
	MessageGroupProps,
	ChatMessageProps,
	ChatComposerProps,
} from "./components/chat";

export { MarkdownEditor } from "./components/markdown-editor/markdown-editor";
export type { MarkdownEditorProps } from "./components/markdown-editor/markdown-editor";
export type { SlashMenuItem } from "./components/markdown-editor/slash-menu";

export { SettingGroup, SettingRow } from "./components/setting-row";
export type {
	SettingGroupProps,
	SettingRowProps,
} from "./components/setting-row";

export { PasswordInput } from "./components/password-input";
export type { PasswordInputProps } from "./components/password-input";

export { ColorPicker, CURATED_COLORS } from "./components/color-picker";
export type {
	ColorPickerProps,
	ColorSwatchOption,
} from "./components/color-picker";

export { QRCode } from "./components/qr-code";
export type { QRCodeProps } from "./components/qr-code";

export { CodeInput } from "./components/code-input";
export type { CodeInputProps } from "./components/code-input";

export { ScoreRing } from "./components/score-ring";
export type { ScoreRingProps } from "./components/score-ring";

export { Progress } from "./components/progress";
export type { ProgressProps } from "./components/progress";

export { Resizable, ResizablePanel } from "./components/resizable/resizable";
export type {
	ResizableProps,
	ResizablePanelProps,
} from "./components/resizable/resizable";

export { DayTimeline } from "./components/day-timeline";
export type {
	DayTimelineProps,
	TimelineSegment,
} from "./components/day-timeline";

export { MonthCalendar } from "./components/month-calendar";
export type {
	MonthCalendarProps,
	MonthEvent,
	CalTone,
} from "./components/month-calendar";

export { FileTree } from "./components/file-tree";
export type { FileTreeProps, FileTreeNode } from "./components/file-tree";
