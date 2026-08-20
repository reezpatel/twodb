const COLUMNS: Array<{ name: string; cards: Array<{ t: string; s: string }> }> =
	[
		{
			name: "Friday",
			cards: [
				{ t: "Rao — monthly staples", s: "9:00 AM" },
				{ t: "Gupta — festival pack", s: "11:30 AM" },
			],
		},
		{
			name: "Saturday",
			cards: [
				{ t: "Khan — party order, 40 kg", s: "1:00 PM" },
				{ t: "North block — full route", s: "5:00 PM" },
				{ t: "Mehta — restock hold", s: "7:00 PM" },
			],
		},
		{
			name: "Sunday",
			cards: [{ t: "Temple trust — bulk order", s: "8:00 AM" }],
		},
	];

/** Beat 5: a sentence becomes a small app around the day's own data. */
export function MiniAppScene() {
	return (
		<div>
			<div className="miniapp__prompt">
				<span>
					<em>“I need a board for weekend home-delivery slots.”</em>
				</span>
			</div>
			<div className="miniapp__built">
				<div className="miniapp__head">
					<span className="miniapp__name">Weekend Deliveries</span>
					<span className="ai-cue">Built from your sentence</span>
				</div>
				<div className="miniapp__cols">
					{COLUMNS.map((col) => (
						<div className="miniapp__col" key={col.name}>
							<div className="miniapp__col-name">{col.name}</div>
							{col.cards.map((card) => (
								<div className="miniapp__card" key={card.t}>
									{card.t}
									<span>{card.s}</span>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
