import { useMemo } from "react";
import qrcode from "qrcode-generator";

export interface QRCodeProps {
	/** The string to encode — otpauth:// URI, URL, anything. */
	value: string;
	/** Rendered edge length in px. */
	size?: number;
	/** Accessible description of what the code opens. */
	label?: string;
}

export function QRCode({ value, size = 160, label = "QR code" }: QRCodeProps) {
	const modules = useMemo(() => {
		const qr = qrcode(0, "M");
		qr.addData(value);
		qr.make();
		const count = qr.getModuleCount();
		const dark: string[] = [];
		for (let r = 0; r < count; r++) {
			for (let c = 0; c < count; c++) {
				if (qr.isDark(r, c)) dark.push(`${c},${r}`);
			}
		}
		return { count, dark };
	}, [value]);

	return (
		<svg
			className="tw-qr"
			width={size}
			height={size}
			viewBox={`0 0 ${modules.count} ${modules.count}`}
			role="img"
			aria-label={label}
			shapeRendering="crispEdges"
		>
			<title>{label}</title>
			{modules.dark.map((m) => {
				const [x, y] = m.split(",");
				return <rect key={m} x={x} y={y} width="1" height="1" />;
			})}
		</svg>
	);
}
