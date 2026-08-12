import { useState } from "react";
import { Badge, Button, CodeInput, IconButton, QRCode } from "@twodb/ui";
import { Check, Copy, RefreshCw, ShieldCheck, X } from "lucide-react";

// No real credential anywhere in this mock: the QR encodes a demo URL and
// the manual-entry key is a placeholder string, so secret scanners have
// nothing to find here.
const QR_URI = "https://twodb.app/demo/two-factor-setup";
const DEMO_MANUAL_KEY = "DEMOKEY2FA000000";

function makeCodes(seed: number) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	return Array.from({ length: 8 }, (_, i) =>
		Array.from(
			{ length: 8 },
			(_, j) => alphabet[(seed * 31 + i * 17 + j * 7) % alphabet.length],
		).join(""),
	);
}

function StepPill({ n }: { n: number }) {
	return <span className="mock-2fa__step-pill tw-tnum">Step {n}</span>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			size="sm"
			variant="secondary"
			onClick={() => {
				navigator.clipboard?.writeText(text).catch(() => {});
				setCopied(true);
				setTimeout(() => setCopied(false), 1600);
			}}
		>
			{copied ? (
				<Check size={14} aria-hidden="true" />
			) : (
				<Copy size={14} aria-hidden="true" />
			)}
			{copied ? "Copied" : label}
		</Button>
	);
}

export function TwoFactorMock() {
	const [enabled, setEnabled] = useState(false);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string>();
	const [seed, setSeed] = useState(3);
	const codes = makeCodes(seed);

	function confirm() {
		if (code === "000000") {
			setError(
				"That code didn't work — check the time on your phone and try again.",
			);
			setCode("");
			return;
		}
		setError(undefined);
		setEnabled(true);
	}

	function reset() {
		setEnabled(false);
		setCode("");
		setError(undefined);
	}

	if (enabled) {
		return (
			<div className="mock-2fa">
				<div className="mock-2fa__panel">
					<div className="mock-2fa__head">
						<span className="mock-2fa__shield">
							<ShieldCheck size={18} aria-hidden="true" />
						</span>
						<h3>Two-factor is on</h3>
						<Badge tone="go">Active</Badge>
					</div>
					<p className="mock-2fa__desc">
						Your account now asks for a one-time code after your password. Keep
						these backup codes somewhere safe — each works once if you lose your
						phone.
					</p>

					<div className="mock-2fa__codes">
						{codes.map((c) => (
							<code key={c} className="tw-tnum">
								{c.slice(0, 4)}-{c.slice(4)}
							</code>
						))}
					</div>

					<div className="mock-2fa__foot">
						<CopyButton text={codes.join("\n")} label="Copy all codes" />
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSeed((s) => s + 1)}
						>
							<RefreshCw size={14} aria-hidden="true" />
							Regenerate
						</Button>
						<Button size="sm" variant="danger" onClick={reset}>
							Turn off
						</Button>
					</div>
				</div>
				<p className="mock-2fa__hint">
					This is the state after a successful setup.
				</p>
			</div>
		);
	}

	return (
		<div className="mock-2fa">
			<div className="mock-2fa__panel">
				<div className="mock-2fa__head">
					<h3>Set up authenticator app</h3>
					<IconButton label="Close setup" icon={<X />} onClick={reset} />
				</div>
				<p className="mock-2fa__desc">
					Each time you log in, in addition to your password, you'll use an
					authenticator app to generate a one-time code.
				</p>

				<div className="mock-2fa__step">
					<div className="mock-2fa__step-head">
						<StepPill n={1} />
						<strong>Scan QR code</strong>
					</div>
					<p className="mock-2fa__desc">
						Scan the QR code below or manually enter the secret key into your
						authenticator app.
					</p>
					<div className="mock-2fa__qr-row">
						<div className="mock-2fa__qr-frame">
							<QRCode
								value={QR_URI}
								size={168}
								label="QR code linking twodb to your authenticator app"
							/>
						</div>
						<div className="mock-2fa__qr-side">
							<span className="mock-2fa__side-title">Can't scan QR code?</span>
							<span className="mock-2fa__side-sub">
								Enter this secret instead:
							</span>
							<code className="mock-2fa__secret tw-tnum">
								{DEMO_MANUAL_KEY.match(/.{1,4}/g)?.join(" ")}
							</code>
							<div>
								<CopyButton text={DEMO_MANUAL_KEY} label="Copy code" />
							</div>
						</div>
					</div>
				</div>

				<div className="mock-2fa__step">
					<div className="mock-2fa__step-head">
						<StepPill n={2} />
						<strong>Get verification code</strong>
					</div>
					<p className="mock-2fa__desc">
						Enter the 6-digit code you see in your authenticator app.
					</p>
					<CodeInput
						length={6}
						value={code}
						onChange={(c) => {
							setCode(c);
							setError(undefined);
						}}
						onComplete={() => setError(undefined)}
						error={error}
						autoFocus
						aria-label="Authenticator verification code"
					/>
					{error ? <span className="mock-2fa__error">{error}</span> : null}
				</div>

				<div className="mock-2fa__foot mock-2fa__foot--end">
					<Button variant="ghost" onClick={reset}>
						Cancel
					</Button>
					<Button onClick={confirm} disabled={code.length < 6}>
						Confirm
					</Button>
				</div>
			</div>
			<p className="mock-2fa__hint">
				Demo: any 6 digits confirm; 000000 shows the error state.
			</p>
		</div>
	);
}
