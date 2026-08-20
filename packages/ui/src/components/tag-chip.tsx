import { Link2, Tag } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { tagChipStyles } from "./tag-chip.style";

export type TagChipIcon = "tag" | "link" | "none";

export interface TagChipProps extends HTMLAttributes<HTMLSpanElement> {
	children: ReactNode;
	color?: string;
	background?: string;
	icon?: TagChipIcon;
}

export function TagChip({
	children,
	color = "var(--accent)",
	background,
	icon = "tag",
	className = "",
	style,
	...rest
}: TagChipProps) {
	const classes = ["tw-tag-chip", className].filter(Boolean).join(" ");
	const chipStyle = {
		...style,
		"--tw-tag-chip-color": color,
		...(background ? { "--tw-tag-chip-bg": background } : null),
	} as CSSProperties;

	return (
		<span className={classes} style={chipStyle} {...rest}>
			<style jsx>{tagChipStyles}</style>
			{icon === "link" && <Link2 aria-hidden size={10} />}
			{icon === "tag" && <Tag aria-hidden size={10} />}
			{children}
		</span>
	);
}
