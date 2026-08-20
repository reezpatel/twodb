import { avatarStyles } from "./avatar.style";
export type AvatarSize = "sm" | "md" | "lg";

export type AvatarPresence = "online" | "away" | "busy" | "offline";

export interface AvatarProps {
	name: string;
	src?: string;
	size?: AvatarSize;
	/** Optional presence dot pinned to the bottom-right edge. */
	presence?: AvatarPresence;
}

function initials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function Avatar({ name, src, size = "md", presence }: AvatarProps) {
	return (
		<span
			className={`tw-avatar tw-avatar--${size}`}
			role="img"
			aria-label={name}
		>
			<style jsx>{avatarStyles}</style>
			{src ? <img src={src} alt="" /> : initials(name)}
			{presence && (
				<span
					className={`tw-avatar__presence tw-avatar__presence--${presence}`}
					aria-hidden="true"
				/>
			)}
		</span>
	);
}
