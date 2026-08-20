import type { ReactNode } from "react";

interface BeatProps {
	id: string;
	cue: string;
	title: string;
	story: string;
	scene: ReactNode;
	vignette: { who: string; line: string };
	flip?: boolean;
}

/** One cue in the day: marker, headline, story, scene, persona. */
export function Beat({
	id,
	cue,
	title,
	story,
	scene,
	vignette,
	flip,
}: BeatProps) {
	return (
		<section
			id={id}
			className={flip ? "beat beat--flip" : "beat"}
			aria-labelledby={`${id}-title`}
		>
			<div className="beat__marker">
				<span className="beat__dot" aria-hidden="true" />
				<span className="beat__time">
					{cue.split("—")[0].trim()} —{" "}
					<strong>{cue.split("—")[1].trim()}</strong>
				</span>
			</div>
			<h2 id={`${id}-title`} data-reveal>
				{title}
			</h2>
			<p
				className="beat__story"
				data-reveal
				style={{ "--d": "90ms" } as React.CSSProperties}
			>
				{story}
			</p>
			<div className="beat__stage">
				<div
					className="scene"
					data-reveal
					style={{ "--d": "140ms" } as React.CSSProperties}
				>
					<span className="scene__label">Synthetic data</span>
					{scene}
				</div>
				<aside
					className="vignette"
					data-reveal
					style={{ "--d": "220ms" } as React.CSSProperties}
				>
					<span className="vignette__who">{vignette.who}</span>
					<p className="vignette__line">{vignette.line}</p>
				</aside>
			</div>
		</section>
	);
}
