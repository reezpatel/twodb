import { Camera, GitCompareArrows, RotateCcw } from "lucide-react";
import { checkpointsScreenStyles } from "./checkpoints-screen.style";

interface Checkpoint {
	id: string;
	title: string;
	time: string;
	files: number;
	auto?: boolean;
}

const CHECKPOINTS: Checkpoint[] = [
	{
		id: "c1",
		title: "Before block reorder wiring",
		time: "2m",
		files: 4,
		auto: true,
	},
	{
		id: "c2",
		title: "Slash menu + custom block picker",
		time: "26m",
		files: 3,
	},
	{
		id: "c3",
		title: "Editor fills pane — drop surface fix",
		time: "58m",
		files: 2,
	},
	{
		id: "c4",
		title: "Pre-refactor snapshot",
		time: "1h",
		files: 7,
		auto: true,
	},
	{ id: "c5", title: "Resizable component landed", time: "3h", files: 5 },
];

export function CheckpointsScreen() {
	return (
		<div className="code-checkpoints">
			<style jsx>{checkpointsScreenStyles}</style>

			<div className="code-checkpoints__actions">
				<button className="code-checkpoints__new">
					<Camera size={14} aria-hidden="true" />
					New checkpoint
				</button>
			</div>

			<div className="code-checkpoints__timeline">
				{CHECKPOINTS.map((checkpoint, i) => (
					<div key={checkpoint.id} className="code-checkpoints__item">
						<div className="code-checkpoints__rail">
							<span className="code-checkpoints__dot" />
							{i < CHECKPOINTS.length - 1 ? (
								<span className="code-checkpoints__line" />
							) : null}
						</div>
						<div className="code-checkpoints__card">
							<div className="code-checkpoints__card-head">
								<span className="code-checkpoints__title">
									{checkpoint.title}
								</span>
								{checkpoint.auto ? (
									<span className="code-checkpoints__auto">auto</span>
								) : null}
							</div>
							<div className="code-checkpoints__meta">
								{checkpoint.time} ago · {checkpoint.files} files
							</div>
							<div className="code-checkpoints__card-actions">
								<button className="code-checkpoints__action">
									<RotateCcw size={12} aria-hidden="true" />
									Restore
								</button>
								<button className="code-checkpoints__action">
									<GitCompareArrows size={12} aria-hidden="true" />
									Compare
								</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
