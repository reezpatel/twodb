import type { ReactNode } from "react";
import { workspaceSceneStyles } from "./workspace-scene.style";

type WorkspaceSceneProps = {
	title: string;
	description: string;
	icon: ReactNode;
};

export function WorkspaceScene({
	title,
	description,
	icon,
}: WorkspaceSceneProps) {
	return (
		<>
			<style jsx>{workspaceSceneStyles}</style>
			<div className="shell__chrome scene__chrome">
				{icon}
				<strong>{title}</strong>
			</div>
			<main className="scene__body" aria-label={title}>
				<section className="scene__panel">
					<h1 className="scene__title">{title}</h1>
					<p className="scene__copy">{description}</p>
				</section>
			</main>
		</>
	);
}
