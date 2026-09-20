export type CommandResult = {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
};

export function asCommandResult(content: unknown): CommandResult | null {
	if (!content || typeof content !== "object") return null;
	const record = content as Record<string, unknown>;
	if (
		typeof record.stdout !== "string" ||
		typeof record.stderr !== "string" ||
		typeof record.exitCode !== "number"
	) {
		return null;
	}
	return {
		stdout: record.stdout,
		stderr: record.stderr,
		exitCode: record.exitCode,
		timedOut: record.timedOut === true,
	};
}

export function RunCommandOutput({ result }: { result: CommandResult }) {
	return (
		<div className="code-chat__cmd">
			{result.stdout ? (
				<pre className="code-chat__tool-output">{result.stdout}</pre>
			) : null}
			{result.stderr ? (
				<pre className="code-chat__tool-output code-chat__tool-output--stderr">
					{result.stderr}
				</pre>
			) : null}
			{!result.stdout && !result.stderr ? (
				<pre className="code-chat__tool-output">(no output)</pre>
			) : null}
			<span className="code-chat__cmd-meta">
				exit {result.exitCode}
				{result.timedOut ? " · timed out" : ""}
			</span>
		</div>
	);
}
