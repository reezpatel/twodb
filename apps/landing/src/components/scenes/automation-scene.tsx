const RULES: Array<{ plain: string; does: string; fired: string }> = [
	{
		plain: "New row in the Leads sheet",
		does: "drafts the welcome email, filed under the lead",
		fired: "Fired 10:04",
	},
	{
		plain: "Invoice #1042 crossed 30 days",
		does: "sends a polite reminder with the payment link",
		fired: "Fired 11:42",
	},
	{
		plain: "Rice 25kg sacks below the reorder line",
		does: "adds it to Friday's purchase list",
		fired: "Fired 12:15",
	},
	{
		plain: "New subscriber in the newsletter",
		does: "joins the sheet and the welcome sequence",
		fired: "Fired 12:31",
	},
];

/** Beat 3: automations firing in plain sight, described in words. */
export function AutomationScene() {
	return (
		<div className="auto">
			{RULES.map((rule, i) => (
				<div className="auto__row" key={rule.plain}>
					<span className="auto__plain">
						{rule.plain} <em>→ {rule.does}</em>
					</span>
					<span
						className="auto__fired ai-cue"
						style={{ "--i": i } as React.CSSProperties}
					>
						{rule.fired}
					</span>
				</div>
			))}
		</div>
	);
}
