const ROWS: Array<{
	when: string;
	what: string;
	note?: string;
	tag?: string;
}> = [
	{
		when: "08:30",
		what: "Milk & bread delivery due",
		note: "Crate count ready at the back door",
	},
	{
		when: "11:30",
		what: "Mehta Traders — supplier call",
		note: "Reorder list drafted",
	},
	{
		when: "STOCK",
		what: "Rice 25kg sacks below the reorder line",
		tag: "flagged",
	},
	{
		when: "OWED",
		what: "6 customer accounts crossed 30 days",
		tag: "reminders drafted",
	},
];

/** The hero moment: the morning brief visibly assembling itself. */
export function BriefScene() {
	return (
		<div
			className="brief"
			role="img"
			aria-label="A morning brief drafted overnight: deliveries, a stock flag, unpaid accounts, and the one thing that matters."
		>
			<div className="brief__head">
				<span className="brief__title">Morning brief — Tuesday</span>
			</div>
			{ROWS.map((row, i) => (
				<div
					className="brief__row"
					key={row.when}
					style={{ "--i": i } as React.CSSProperties}
				>
					<span className="brief__when">{row.when}</span>
					<span className="brief__what">
						{row.what}
						{row.note ? <span className="brief__note">{row.note}</span> : null}
					</span>
					{row.tag ? <span className="brief__tag">{row.tag}</span> : null}
				</div>
			))}
			<div
				className="brief__row brief__row--one"
				style={{ "--i": ROWS.length } as React.CSSProperties}
			>
				<span className="brief__one-label">The one thing</span>
				<span className="brief__what">
					Confirm the school's festival bulk order — they asked twice.
				</span>
			</div>
			<div className="brief__ai">
				<span className="ai-cue">
					Drafted 06:30 · from Deliveries, Accounts, Stock
				</span>
			</div>
		</div>
	);
}
