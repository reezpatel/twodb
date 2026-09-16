import { useSyncExternalStore } from "react";

let open = true;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useNotesSidenav() {
	const isOpen = useSyncExternalStore(subscribe, () => open);

	return {
		isOpen,
		toggle: () => {
			open = !open;
			listeners.forEach((listener) => listener());
		},
	};
}
