import { IconButton, Menu, MenuDivider, MenuItem, Segmented } from "@twodb/ui";
import { Code2, MessageSquare, MoreVertical, Settings } from "lucide-react";
import type { CodeView } from "../../hooks/use-code-scene.hook";
import { codeHeaderStyles } from "./header.style";

interface HeaderProps {
	view: CodeView;
	onViewChange: (view: CodeView) => void;
}

export const Header = ({ view, onViewChange }: HeaderProps) => {
	return (
		<header className="code-header">
			<style jsx>{codeHeaderStyles}</style>
			<span className="code-header__title">Code</span>
			<div className="code-header__switch">
				<Segmented
					aria-label="View"
					items={[
						{ id: "code", label: "Code", icon: <Code2 size={14} /> },
						{ id: "chat", label: "Chat", icon: <MessageSquare size={14} /> },
					]}
					value={view}
					onValueChange={(id) => onViewChange(id as CodeView)}
				/>
			</div>
			<Menu
				placement="bottom-end"
				trigger={<IconButton label="More" icon={<MoreVertical size={16} />} />}
			>
				<MenuItem icon={<Code2 size={14} />}>Open in editor</MenuItem>
				<MenuItem icon={<Settings size={14} />}>Agent settings</MenuItem>
				<MenuDivider />
				<MenuItem danger>Close session</MenuItem>
			</Menu>
		</header>
	);
};
