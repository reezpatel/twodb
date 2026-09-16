import { Skeleton } from "@twodb/ui";
import { loadingGridStyles } from "./loading-grid.style";

export function LoadingGrid() {
	return (
		<div className="plugins-grid" aria-label="Loading integrations">
			<style jsx>{loadingGridStyles}</style>
			{Array.from({ length: 6 }, (_, index) => (
				<div className="plugins-card plugins-card--loading" key={index}>
					<Skeleton width={72} height={72} />
					<Skeleton width="78%" />
					<Skeleton width="100%" />
					<Skeleton width="62%" />
				</div>
			))}
		</div>
	);
}
