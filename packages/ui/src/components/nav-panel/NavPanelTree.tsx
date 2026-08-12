import type {} from "styled-jsx";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, Folder } from "lucide-react";
import {
	Tree,
	useSimpleTree,
	type CursorProps,
	type NodeRendererProps,
} from "react-arborist";
import { navPanelTreeStyles } from "./NavPanelTree.style";

export interface NavPanelTreeNode {
	id: string;
	name: string;
	icon?: ReactNode;
	color?: string;
	children?: NavPanelTreeNode[];
}

export interface NavPanelTreeProps {
	ariaLabel: string;
	initialData: readonly NavPanelTreeNode[];
	height?: number;
	selection?: string;
	onPick?: (id: string, node: NavPanelTreeNode) => void;
	onChange?: (data: readonly NavPanelTreeNode[]) => void;
	rowHeight?: number;
	indent?: number;
	className?: string;
}

function countVisibleRows(
	nodes: readonly NavPanelTreeNode[],
	closedIds: Set<string>,
) {
	let count = 0;

	for (const node of nodes) {
		count += 1;
		if (node.children?.length && !closedIds.has(node.id)) {
			count += countVisibleRows(node.children, closedIds);
		}
	}

	return count;
}

function NavPanelTreeCursor({ top, left, indent }: CursorProps) {
	return (
		<div
			className="tw-navpanel-tree__cursor"
			style={{ top: top - 1, left, right: indent } as CSSProperties}
		>
			<span />
		</div>
	);
}

export function NavPanelTree({
	ariaLabel,
	initialData,
	height,
	selection,
	onPick,
	onChange,
	rowHeight = 31,
	indent = 12,
	className = "",
}: NavPanelTreeProps) {
	const [closedIds, setClosedIds] = useState(() => new Set<string>());
	const [data, controller] = useSimpleTree<NavPanelTreeNode>(initialData, {
		onChange,
	});
	const classes = ["tw-navpanel-tree", className].filter(Boolean).join(" ");
	const treeHeight =
		height ??
		Math.max(rowHeight, countVisibleRows(data, closedIds) * rowHeight + 4);

	function Node({
		node,
		style,
		dragHandle,
	}: NodeRendererProps<NavPanelTreeNode>) {
		const rowGap = 2;
		const rowStyle = {
			...style,
			top: typeof style.top === "number" ? style.top + rowGap / 2 : style.top,
			height:
				typeof style.height === "number"
					? Math.max(0, style.height - rowGap)
					: style.height,
			"--tw-navpanel-tree-depth": node.level,
		} as CSSProperties;
		const iconStyle = {
			"--tw-navpanel-tree-icon-color": node.data.color ?? "var(--ink-3)",
		} as CSSProperties;
		const icon =
			node.data.icon ?? (node.isInternal ? <Folder size={14} /> : null);

		return (
			<div
				ref={dragHandle}
				className={[
					"tw-navpanel-tree__node",
					node.isSelected ? "is-active" : "",
					node.isOpen ? "is-open" : "",
					node.isDragging ? "is-dragging" : "",
					node.willReceiveDrop ? "will-receive-drop" : "",
				]
					.filter(Boolean)
					.join(" ")}
				style={rowStyle}
			>
				{node.isInternal ? (
					<button
						type="button"
						className="tw-navpanel-tree__toggle"
						aria-label={`${node.isOpen ? "Collapse" : "Expand"} ${node.data.name}`}
						onClick={(event) => {
							event.stopPropagation();
							node.toggle();
						}}
					>
						<ChevronRight size={13} aria-hidden="true" />
					</button>
				) : (
					<span className="tw-navpanel-tree__toggle tw-navpanel-tree__toggle--spacer" />
				)}
				<span
					className="tw-navpanel-tree__icon"
					aria-hidden="true"
					style={iconStyle}
				>
					{icon}
				</span>
				<span className="tw-navpanel-tree__label">{node.data.name}</span>
			</div>
		);
	}

	return (
		<div className="tw-navpanel-treewrap">
			<style jsx>{navPanelTreeStyles}</style>
			<Tree<NavPanelTreeNode>
				aria-label={ariaLabel}
				className={classes}
				data={data}
				disableDrop={({ parentNode }) =>
					!parentNode.isRoot && parentNode.isLeaf
				}
				disableEdit
				disableMultiSelection
				disableDeselectOnClick
				height={treeHeight}
				indent={indent}
				onActivate={(node) => onPick?.(node.id, node.data)}
				onMove={controller.onMove}
				onToggle={(id) => {
					setClosedIds((current) => {
						const next = new Set(current);
						if (next.has(id)) next.delete(id);
						else next.add(id);
						return next;
					});
				}}
				openByDefault
				paddingBottom={2}
				paddingTop={2}
				renderCursor={NavPanelTreeCursor}
				rowHeight={rowHeight}
				selection={selection}
				width="100%"
			>
				{Node}
			</Tree>
		</div>
	);
}
