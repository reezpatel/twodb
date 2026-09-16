import { useCallback, useEffect, useRef, useState } from "react";

const RESET_MS = 2_000;

export function useCopy() {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);

	const copy = useCallback(async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
		} catch {
			setCopied(false);
			return;
		}
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(false), RESET_MS);
	}, []);

	return { copied, copy };
}
