import { useEffect } from "react";
import { Mic } from "lucide-react";
import { useShellState } from "../../shell/state";
import { LiveScribeMock } from "./live-scribe-mock";
import { recordingSceneStyles } from "./recording-scene.style";

export function RecordingScene() {
	const { pickSidebar } = useShellState();

	useEffect(() => {
		pickSidebar("recording");
	}, []);

	return (
		<>
			<style jsx>{recordingSceneStyles}</style>
			<div className="shell__chrome recording__chrome">
				<Mic size={15} />
				<strong>Recording</strong>
			</div>
			<main className="recording__body" aria-label="Recording">
				<LiveScribeMock />
			</main>
		</>
	);
}
