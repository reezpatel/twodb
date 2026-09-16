import type { ReactNode } from "react";
import { Code2, ListChecks } from "lucide-react";
import { NavPanelGroup, NavPanelItem, NavPanelSection } from "@twodb/ui";
import { ContentTree } from "../content-tree/content-tree";
import { notesSidenavStyles } from "./notes-sidenav.style";

type FavoriteItem = {
	id: string;
	label: string;
	icon?: ReactNode;
	color?: string;
};

const FAVORITES: FavoriteItem[] = [
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

export function NotesSidenav() {
	return (
		<aside className="notes-sidenav" aria-label="Notes navigation">
			<style jsx>{notesSidenavStyles}</style>
			<NavPanelSection
				label="Favorites"
				meta={<span className="tw-tnum">{FAVORITES.length}</span>}
			/>
			<NavPanelGroup>
				{FAVORITES.map((item) => (
					<NavPanelItem
						key={item.id}
						icon={item.icon}
						color={item.color}
						label={item.label}
					/>
				))}
			</NavPanelGroup>

			<div className="notes-sidenav__rule" />

			<ContentTree />
		</aside>
	);
}
