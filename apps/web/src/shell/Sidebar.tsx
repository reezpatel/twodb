import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	CalendarDays,
	Code2,
	FileText,
	Files,
	HardDrive,
	Inbox,
	ListChecks,
	LogOut,
	Mail,
	Mic,
	Moon,
	MessageCircle,
	MessageSquareText,
	SlidersHorizontal,
	Sun,
	User,
	Warehouse,
	Workflow,
} from "lucide-react";
import {
	AccountMenu,
	MenuDivider,
	MenuItem,
	NavPanel,
	NavPanelBadge,
	NavPanelCount,
	NavPanelFooter,
	NavPanelGroup,
	NavPanelItem,
	NavPanelSection,
	NavPanelTree,
	type NavPanelTreeNode,
} from "@twodb/ui";
import { sidebarStyles } from "./Sidebar.style.jsx";
import { useShellState } from "./state";

type FlatNavItem = {
	id: string;
	label: string;
	icon?: ReactNode;
	color?: string;
	count?: string;
	badge?: boolean;
	route?: string;
};

const QUICK_NAV: FlatNavItem[] = [
	{
		id: "inbox",
		label: "Inbox",
		icon: <Inbox size={15} />,
		color: "#e8890c",
		route: "/inbox",
		count: "6",
		badge: true,
	},
];

const WORKSPACE_NAV: FlatNavItem[] = [
	{
		id: "email",
		label: "Email",
		icon: <Mail size={15} />,
		color: "#3563d9",
		route: "/email",
		count: "28",
	},
	{
		id: "calendar",
		label: "Calendar",
		icon: <CalendarDays size={15} />,
		color: "#c2334d",
		route: "/calendar",
		count: "4",
	},
	{
		id: "files",
		label: "Files",
		icon: <Files size={15} />,
		color: "#d9930d",
		route: "/files",
		count: "156",
	},
	{
		id: "automations",
		label: "Automations",
		icon: <Workflow size={15} />,
		color: "#1e7d46",
		route: "/automations",
		count: "7",
	},
	{
		id: "chat",
		label: "Chat",
		icon: <MessageCircle size={15} />,
		color: "#e8890c",
		route: "/chat",
		count: "12",
	},
	{
		id: "code",
		label: "Code",
		icon: <Code2 size={15} />,
		color: "#626274",
		route: "/code",
		count: "3",
	},
];

const FAVORITE_NAV: FlatNavItem[] = [
	{
		id: "my-first-app",
		label: "My First App",
		icon: <Code2 size={15} />,
		color: "#3563d9",
	},
	{
		id: "my-first-list",
		label: "My First List",
		icon: <ListChecks size={15} />,
		color: "#1e7d46",
	},
];

const TREE_ROUTES: Record<string, string> = {
	recording: "/recording",
};

const CONTENT_TREE: NavPanelTreeNode[] = [
	{
		id: "content-folder-1",
		name: "Folder 1",
		color: "#3563d9",
		children: [
			{
				id: "content-folder-2",
				name: "Folder 2",
				color: "#7c4dcc",
				children: [
					{
						id: "personal-notes",
						name: "Personal Notes",
						icon: <FileText size={14} />,
						color: "#3563d9",
					},
					{
						id: "personal-todo",
						name: "Personal Todo",
						icon: <ListChecks size={14} />,
						color: "#1e7d46",
					},
				],
			},
			{
				id: "work-notes",
				name: "Work Notes",
				icon: <FileText size={14} />,
				color: "#e8890c",
			},
		],
	},
	{
		id: "release-notes",
		name: "Release Notes",
		icon: <FileText size={14} />,
		color: "#c2334d",
	},
	{
		id: "events",
		name: "Events",
		icon: <CalendarDays size={14} />,
		color: "#d9930d",
	},
	{
		id: "recording",
		name: "Recording",
		icon: <Mic size={14} />,
		color: "#7c4dcc",
	},
];

const APPS_TREE: NavPanelTreeNode[] = [
	{
		id: "apps-folder-1",
		name: "Folder 1",
		color: "#1e7d46",
		children: [
			{
				id: "storage-manager",
				name: "Storage Manager",
				icon: <HardDrive size={14} />,
				color: "#3563d9",
			},
		],
	},
	{
		id: "feedback-manager",
		name: "Feedback Manager",
		icon: <MessageSquareText size={14} />,
		color: "#7c4dcc",
	},
	{
		id: "apps-folder-2",
		name: "Folder 2",
		color: "#d9930d",
		children: [
			{
				id: "warehousing",
				name: "Warehousing",
				icon: <Warehouse size={14} />,
				color: "#e8890c",
			},
		],
	},
];

function navItemMeta(item: FlatNavItem) {
	if (!item.count) return undefined;
	return item.badge ? (
		<NavPanelBadge>{item.count}</NavPanelBadge>
	) : (
		<NavPanelCount>{item.count}</NavPanelCount>
	);
}

export function Sidebar() {
	const { sideSel, pickSidebar, phase, togglePhase } = useShellState();
	const navigate = useNavigate();
	const location = useLocation();
	const activeRouteItem = [...QUICK_NAV, ...WORKSPACE_NAV].find(
		(item) => item.route === location.pathname,
	);
	const activeId = activeRouteItem?.id ?? sideSel;

	function pickItem(item: FlatNavItem) {
		pickSidebar(item.id);
		navigate(item.route ?? "/notes");
	}

	function pickTreeItem(id: string) {
		pickSidebar(id);
		navigate(TREE_ROUTES[id] ?? "/notes");
	}

	const contentSelection = ["/notes", "/recording"].includes(location.pathname)
		? sideSel
		: undefined;

	return (
		<>
			<style jsx>{sidebarStyles}</style>
			<div className="shell__chrome shell__chrome--side" />

			<div className="shell__sidebarSlot">
				<NavPanel aria-label="Workspace navigation">
					<NavPanelGroup>
						{QUICK_NAV.map((item) => (
							<NavPanelItem
								key={item.id}
								icon={item.icon}
								color={item.color}
								label={item.label}
								active={activeId === item.id}
								meta={navItemMeta(item)}
								onClick={() => pickItem(item)}
							/>
						))}
					</NavPanelGroup>

					<NavPanelGroup>
						{WORKSPACE_NAV.map((item) => (
							<NavPanelItem
								key={item.id}
								icon={item.icon}
								color={item.color}
								label={item.label}
								active={activeId === item.id}
								meta={navItemMeta(item)}
								onClick={() => pickItem(item)}
							/>
						))}
					</NavPanelGroup>

					<div className="shell__sidebar-rule shell__sidebar-rule--wide" />

					<NavPanelSection
						label="Favorites"
						meta={<span className="tw-tnum">3</span>}
					/>
					<NavPanelGroup>
						{FAVORITE_NAV.map((item) => (
							<NavPanelItem
								key={item.id}
								icon={item.icon}
								color={item.color}
								label={item.label}
								active={location.pathname === "/notes" && sideSel === item.id}
								onClick={() => pickItem(item)}
							/>
						))}
					</NavPanelGroup>

					<div className="shell__sidebar-rule" />

					<NavPanelSection label="Content" onAdd={() => {}} />
					<NavPanelTree
						ariaLabel="Content folders"
						initialData={CONTENT_TREE}
						onPick={pickTreeItem}
						selection={contentSelection}
					/>

					<div className="shell__sidebar-rule shell__sidebar-rule--wide" />

					<NavPanelSection label="Apps" onAdd={() => {}} />
					<NavPanelTree
						ariaLabel="App folders"
						initialData={APPS_TREE}
						onPick={pickTreeItem}
						selection={location.pathname === "/notes" ? sideSel : undefined}
					/>

					<NavPanelFooter>
						<AccountMenu name="Asha Verma" sub="Clinic workspace">
							<MenuItem icon={<User />}>Profile</MenuItem>
							<MenuItem icon={<SlidersHorizontal />}>Preferences</MenuItem>
							<MenuItem
								icon={phase === "day" ? <Moon /> : <Sun />}
								onClick={togglePhase}
							>
								{phase === "day"
									? "Switch to dark theme"
									: "Switch to light theme"}
							</MenuItem>
							<MenuDivider />
							<MenuItem icon={<LogOut />} danger>
								Log out
							</MenuItem>
						</AccountMenu>
					</NavPanelFooter>
				</NavPanel>
			</div>
		</>
	);
}
