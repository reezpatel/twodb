import { Button, EmptyState } from "@twodb/ui";
import { Blocks, SearchX } from "lucide-react";
import type { PluginsSectionState } from "./plugins-section.types";

export function EmptyCatalog({ state }: { state: PluginsSectionState }) {
	const catalogIsEmpty = state.catalog.length === 0;

	return (
		<EmptyState
			icon={catalogIsEmpty ? <Blocks /> : <SearchX />}
			iconTone="accent"
			title="No integrations found"
			description={
				catalogIsEmpty
					? "No plugin templates are available yet. You can still add a custom integration."
					: "Try another search or filter."
			}
			action={
				catalogIsEmpty ? (
					<Button variant="secondary" onClick={state.openCustomDialog}>
						Add custom integration
					</Button>
				) : undefined
			}
		/>
	);
}
