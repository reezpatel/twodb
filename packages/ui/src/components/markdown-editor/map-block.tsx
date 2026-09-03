import { MapPin } from "lucide-react";
import css from "styled-jsx/css";

const mapBlockStyles = css`
  .tw-map {
    position: relative;
    height: 220px;
    background: var(--bg-band);
  }

  .tw-map iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  .tw-map__label {
    position: absolute;
    left: var(--space-2);
    bottom: var(--space-2);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--r-sm);
    background: var(--surface);
    border: 1px solid var(--line);
    font-family: var(--font-cue);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: var(--tracking-cue);
    color: var(--ink-2);
    pointer-events: none;
  }
`;

/** Built-in `map` custom block — OpenStreetMap embed, no API key needed. */
export function MapBlock(props: Record<string, unknown>) {
	const lat = Number(props.lat ?? 12.9716);
	const lng = Number(props.lng ?? 77.5946);
	const label = typeof props.label === "string" ? props.label : null;
	const d = 0.04; // ~4km window
	const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
	const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

	return (
		<div className="tw-map">
			<style jsx>{mapBlockStyles}</style>
			<iframe src={src} title={label ?? "Map"} loading="lazy" />
			<span className="tw-map__label">
				<MapPin size={11} />
				{label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
			</span>
		</div>
	);
}
