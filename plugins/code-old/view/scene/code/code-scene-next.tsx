import { Resizable, ResizablePanel } from "@twodb/ui";
import { ChatSection } from "../../components/chat-section/chat-section";
import { Sidebar } from "../../components/sidebar/sidebar";
import { Sidenav } from "../../components/sidenav/sidenav";
import { useCodeScene } from "../../hooks/use-code-scene.hook";
import { Ribbon } from "./ribbon";
import { codeSceneNextStyles } from "./code-scene-next.style";

export function CodeSceneNext() {
	const { selectedSessionId, selectSession } = useCodeScene();

	return (
		<div className="code-next">
			<style jsx>{codeSceneNextStyles}</style>
			<div />
			<div className="code-next__body">
				<Resizable direction="horizontal">
					<ResizablePanel size={240} minSize={180} maxSize={400}>
						<div className="code-next__pane-side">
							<Ribbon />
							<Sidenav
								selectedId={selectedSessionId}
								onSelect={selectSession}
							/>
						</div>
					</ResizablePanel>
					<ResizablePanel size="auto">
						<ChatSection sessionId={selectedSessionId} />
					</ResizablePanel>
					<ResizablePanel size="26%" minSize="15%" maxSize="45%">
						<div className="code-next__pane-side">
							<Sidebar />
						</div>
					</ResizablePanel>
				</Resizable>
			</div>
		</div>
	);
}
