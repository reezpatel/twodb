import { Video } from "lucide-react";
import { LiveScribeMock } from "./live-scribe-mock";
import { meetingsSceneStyles } from "./meetings-scene.style";

export function MeetingsScene() {
	return (
		<>
			<style jsx>{meetingsSceneStyles}</style>
			<div className="shell__chrome meetings__chrome">
				<Video size={15} />
				<strong>Meetings</strong>
			</div>
			<main className="meetings__body" aria-label="Meetings">
				<LiveScribeMock />
			</main>
		</>
	);
}
