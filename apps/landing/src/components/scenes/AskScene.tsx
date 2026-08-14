const DEBTORS = [
	{ name: "K. Sharma", amount: "₹18,400", days: "41 days" },
	{ name: "Rao Textiles", amount: "₹21,000", days: "36 days" },
	{ name: "N. D'Souza", amount: "₹8,800", days: "33 days" },
];

/** Beat 4: a question, answered from the business's own records. */
export function AskScene() {
	return (
		<div className="ask">
			<div className="ask__q">Which customers haven't paid?</div>
			<div className="ask__a">
				<div className="ask__a-head">
					<span className="ai-cue">Answered just now</span>
				</div>
				<p className="ask__line">
					Three customers have accounts past 30 days — ₹48,200 in all.
				</p>
				<div className="ask__table">
					{DEBTORS.map((d) => (
						<div className="ask__trow" key={d.name}>
							<strong>{d.name}</strong>
							<span>{d.amount}</span>
							<span>{d.days}</span>
						</div>
					))}
				</div>
				<p className="ask__src">
					From Accounts + Customers · reminders already drafted
				</p>
			</div>
		</div>
	);
}
