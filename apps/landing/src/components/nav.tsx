import { useEffect, useState } from "react";

/** Wordmark + the action, nothing else. Phases night over night fields. */
export function Nav() {
	const [phase, setPhase] = useState<"night" | "day">("night");

	useEffect(() => {
		const nightFields = Array.from(
			document.querySelectorAll<HTMLElement>("[data-nav='night']"),
		);
		if (nightFields.length === 0) return;
		const lit = new Set<Element>();
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) lit.add(entry.target);
					else lit.delete(entry.target);
				}
				setPhase(lit.size > 0 ? "night" : "day");
			},
			{ rootMargin: "-72px 0px 0px 0px", threshold: 0 },
		);
		nightFields.forEach((el) => io.observe(el));
		return () => io.disconnect();
	}, []);

	return (
		<header className="nav" data-phase={phase}>
			<div className="wrap nav__inner">
				<a className="nav__wordmark" href="#top">
					twodb
				</a>
				<a className="nav__cta" href="#waitlist">
					Join the waitlist
				</a>
			</div>
		</header>
	);
}
