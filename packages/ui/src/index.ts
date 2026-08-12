/* Fonts: Outfit (UI/body) + IBM Plex Sans (cue labels, display caps) */
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import "./styles.css";

export { Button } from "./components/Button";
export type {
	ButtonProps,
	ButtonVariant,
	ButtonSize,
} from "./components/Button";

export { Input } from "./components/Input";
export type { InputProps } from "./components/Input";

export { Textarea } from "./components/Textarea";
export type { TextareaProps } from "./components/Textarea";

export { Select } from "./components/Select";
export type { SelectProps } from "./components/Select";

export { Checkbox } from "./components/Checkbox";
export type { CheckboxProps } from "./components/Checkbox";

export { Radio } from "./components/Radio";
export type { RadioProps } from "./components/Radio";

export { Switch } from "./components/Switch";
export type { SwitchProps } from "./components/Switch";

export { Badge } from "./components/Badge";
export type { BadgeProps, BadgeTone, BadgeSize } from "./components/Badge";

export { TagChip } from "./components/TagChip";
export type { TagChipIcon, TagChipProps } from "./components/TagChip";

export { Card } from "./components/Card";
export type { CardDensity, CardProps, CardTone } from "./components/Card";

export { Tabs } from "./components/Tabs";
export type { TabsProps, TabItem } from "./components/Tabs";

export { Segmented } from "./components/Segmented";
export type { SegmentedProps, SegmentedItem } from "./components/Segmented";

export { Dialog } from "./components/Dialog";
export type { DialogProps } from "./components/Dialog";

export { Avatar } from "./components/Avatar";
export type {
	AvatarProps,
	AvatarSize,
	AvatarPresence,
} from "./components/Avatar";

export { Divider } from "./components/Divider";
export type { DividerProps } from "./components/Divider";

export { Skeleton } from "./components/Skeleton";
export type { SkeletonProps } from "./components/Skeleton";

export { Tooltip } from "./components/Tooltip";
export type { TooltipProps, TooltipSide } from "./components/Tooltip";

export { Kbd } from "./components/Kbd";
export type { KbdProps } from "./components/Kbd";

export { IconButton } from "./components/IconButton";
export type {
	IconButtonProps,
	IconButtonVariant,
	IconButtonSize,
} from "./components/IconButton";

export { Menu, MenuItem, MenuDivider } from "./components/Menu";
export type {
	MenuProps,
	MenuItemProps,
	MenuPlacement,
} from "./components/Menu";

export { SearchInput } from "./components/SearchInput";
export type { SearchInputProps } from "./components/SearchInput";

export { NavRail } from "./components/NavRail";
export type { NavRailProps, NavRailItem } from "./components/NavRail";

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

export { AccountMenu } from "./components/AccountMenu";
export type { AccountMenuProps } from "./components/AccountMenu";

export { Table, THead, TBody, TR, TH, TD } from "./components/Table";
export type { THProps, TDProps } from "./components/Table";

export { DataTable } from "./components/DataTable";
export type {
	DataTableProps,
	DataColumn,
	FilterSpec,
	FilterRule,
} from "./components/DataTable";

export { DataGantt } from "./components/DataGantt";
export type {
	DataGanttProps,
	DataGanttItem,
	DataGanttMeta,
	DataGanttMilestone,
} from "./components/DataGantt";

export { CellView, CellEditor } from "./components/cells";
export type { CellType, CellOption } from "./components/cells";

export { Calendar } from "./components/Calendar";
export type { CalendarProps } from "./components/Calendar";

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

export { MarkdownEditor } from "./components/MarkdownEditor";
export type { MarkdownEditorProps } from "./components/MarkdownEditor";

export { SettingGroup, SettingRow } from "./components/SettingRow";
export type {
	SettingGroupProps,
	SettingRowProps,
} from "./components/SettingRow";

export { PasswordInput } from "./components/PasswordInput";
export type { PasswordInputProps } from "./components/PasswordInput";

export { ColorPicker, CURATED_COLORS } from "./components/ColorPicker";
export type {
	ColorPickerProps,
	ColorSwatchOption,
} from "./components/ColorPicker";

export { QRCode } from "./components/QRCode";
export type { QRCodeProps } from "./components/QRCode";

export { CodeInput } from "./components/CodeInput";
export type { CodeInputProps } from "./components/CodeInput";

export { ScoreRing } from "./components/ScoreRing";
export type { ScoreRingProps } from "./components/ScoreRing";

export { Progress } from "./components/Progress";
export type { ProgressProps } from "./components/Progress";

export { DayTimeline } from "./components/DayTimeline";
export type {
	DayTimelineProps,
	TimelineSegment,
} from "./components/DayTimeline";

export { MonthCalendar } from "./components/MonthCalendar";
export type {
	MonthCalendarProps,
	MonthEvent,
	CalTone,
} from "./components/MonthCalendar";

export { FileTree } from "./components/FileTree";
export type { FileTreeProps, FileTreeNode } from "./components/FileTree";
