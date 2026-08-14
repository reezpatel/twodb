import { useEffect } from "react";

/**
 * One quiet reveal for the whole page: elements marked [data-reveal]
 * (and every .beat, for its cue-dot and firing states) rise in once.
 */
export function useReveal() {
	useEffect(() => {
		const els = Array.from(
			document.querySelectorAll<HTMLElement>("[data-reveal], .beat"),
		);
		if (!("IntersectionObserver" in window)) {
			els.forEach((el) => el.classList.add("is-in"));
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.classList.add("is-in");
						io.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
		);
		els.forEach((el) => io.observe(el));
		return () => io.disconnect();
	}, []);
}
