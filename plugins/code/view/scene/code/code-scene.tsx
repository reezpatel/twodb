import { Resizable, ResizablePanel } from "@twodb/ui";
import { ChatSection } from "../../components/chat-section/chat-section";
import { Header } from "../../components/header/header";
import { Sidebar } from "../../components/sidebar/sidebar";
import { Sidenav } from "../../components/sidenav/sidenav";
import { useCodeScene } from "../../hooks/use-code-scene.hook";
import { codeSceneStyles } from "./code-scene.style";

export const CodeScene = () => {
	const { view, setView, selectedSessionId, selectSession } = useCodeScene();

	return (
		<div className="code">
			<style jsx>{codeSceneStyles}</style>
			<Header view={view} onViewChange={setView} />
			<div className="code__body">
				<Resizable direction="horizontal">
					<ResizablePanel size={240} minSize={180} maxSize={400}>
						<Sidenav selectedId={selectedSessionId} onSelect={selectSession} />
					</ResizablePanel>
					<ResizablePanel size="auto">
						<ChatSection />
					</ResizablePanel>
					<ResizablePanel size="26%" minSize="15%" maxSize="45%">
						<Sidebar />
					</ResizablePanel>
				</Resizable>
			</div>
		</div>
	);
};
