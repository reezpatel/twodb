import { Skeleton } from "@twodb/ui";

const radiusSm = { borderRadius: "var(--r-sm)" };
const radiusMd = { borderRadius: "var(--r-md)" };

export function FullPageLoader() {
	return (
		<div
			style={{
				display: "grid",
				placeItems: "center",
				minHeight: "100dvh",
				padding: "var(--space-5)",
				background: "var(--bg)",
			}}
		>
			<div
				style={{
					display: "grid",
					gap: "var(--space-3)",
					width: "100%",
					maxWidth: 360,
				}}
			>
				<div style={radiusMd}>
					<Skeleton height={32} width="60%" />
				</div>
				<div style={radiusSm}>
					<Skeleton height={14} width="90%" />
				</div>
				<div style={radiusSm}>
					<Skeleton height={14} width="80%" />
				</div>
				<div style={radiusSm}>
					<Skeleton height={14} width="70%" />
				</div>
				<div
					style={{
						display: "flex",
						gap: "var(--space-2)",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={radiusMd}>
						<Skeleton height={36} width={96} />
					</div>
					<div style={radiusMd}>
						<Skeleton height={36} width={96} />
					</div>
				</div>
			</div>
		</div>
	);
}
