const THREADS = [
	{
		src: "Mail",
		who: "City Wholesale Co.",
		sum: "The new price list is in. Three items you stock went up 6%; everything else unchanged.",
		when: "08:12",
		handler: null,
	},
	{
		src: "WhatsApp",
		who: "Priya — customer",
		sum: "Asks if the festival gift packs are ready. They are — two variants left.",
		when: "08:40",
		handler: "You're replying",
	},
	{
		src: "WhatsApp",
		who: "Imran — office canteen",
		sum: "Wants a monthly bulk order, billed on the 1st. Draft quote is attached.",
		when: "08:52",
		handler: "Ravi is replying",
	},
	{
		src: "Team",
		who: "Counter staff",
		sum: "The card machine keeps dropping the network. Technician visit proposed for 4 pm.",
		when: "09:05",
		handler: null,
	},
	{
		src: "Mail",
		who: "Mehta Traders",
		sum: "The reorder quote is 8% higher — they can hold last month's price until Friday.",
		when: "09:26",
		handler: null,
	},
];

/** Beat 2: every inbox, one queue — one WhatsApp number, the whole team answering. */
export function InboxScene() {
	return (
		<div>
			<div className="inbox__head">
				<span className="cue">Store WhatsApp · one number</span>
				<span className="cue tnum">3 of you answering</span>
			</div>
			{THREADS.map((t) => (
				<div className="inbox__row" key={t.who}>
					<span className="inbox__src">{t.src}</span>
					<div>
						<div className="inbox__who">{t.who}</div>
						<div className="inbox__sum">{t.sum}</div>
					</div>
					<div className="inbox__meta">
						<span className="inbox__when">{t.when}</span>
						{t.handler ? (
							<span className="inbox__handler">{t.handler}</span>
						) : null}
					</div>
				</div>
			))}
		</div>
	);
}
