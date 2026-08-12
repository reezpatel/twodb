import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@twodb/ui";
import { Paperclip, Upload, X } from "lucide-react";
import { filesSceneStyles } from "./FilesScene.style.jsx";

export interface UploadedFile {
	name: string;
	size: number;
}

interface UploadEntry extends UploadedFile {
	id: string;
	progress: number;
	status: "uploading" | "complete";
}

export function formatFileSize(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${bytes} B`;
}

export function UploadDialog({
	onClose,
	onDone,
}: {
	onClose: () => void;
	onDone: (files: UploadedFile[]) => void;
}) {
	const [entries, setEntries] = useState<UploadEntry[]>([]);
	const [dragging, setDragging] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	useEffect(() => {
		if (!entries.some((e) => e.status === "uploading")) return;
		const t = setInterval(() => {
			setEntries((cur) =>
				cur.map((e) => {
					if (e.status !== "uploading") return e;
					const next = Math.min(
						100,
						e.progress + 5 + Math.floor(Math.random() * 15),
					);
					return {
						...e,
						progress: next,
						status: next >= 100 ? "complete" : "uploading",
					};
				}),
			);
		}, 250);
		return () => clearInterval(t);
	}, [entries]);

	const addFiles = (list: FileList | File[]) => {
		const next = Array.from(list).map((f, i) => ({
			id: `${Date.now()}-${i}`,
			name: f.name,
			size: f.size,
			progress: 0,
			status: "uploading" as const,
		}));
		if (next.length) setEntries((cur) => [...cur, ...next]);
	};

	const uploading = entries.some((e) => e.status === "uploading");

	return (
		<div className="mock-pf__upbackdrop" onMouseDown={onClose}>
			<style jsx>{filesSceneStyles}</style>
			<div
				className="mock-pf__updialog"
				role="dialog"
				aria-modal="true"
				aria-label="Upload files"
				onMouseDown={(e) => e.stopPropagation()}
			>
				<div className="mock-pf__uphead">
					<div>
						<h2 className="mock-pf__uptitle">Upload files</h2>
						<p className="mock-pf__updesc">
							Drag and drop files to add them to Project Files.
						</p>
					</div>
					<IconButton
						icon={<X />}
						label="Close upload dialog"
						variant="ghost"
						size="sm"
						onClick={onClose}
					/>
				</div>

				<div
					className={
						dragging ? "mock-pf__dropzone is-dragging" : "mock-pf__dropzone"
					}
					onDragOver={(e) => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragging(false);
						addFiles(e.dataTransfer.files);
					}}
					onClick={() => fileRef.current?.click()}
				>
					<input
						ref={fileRef}
						type="file"
						multiple
						hidden
						aria-label="Choose files to upload"
						onChange={(e) => {
							if (e.target.files) addFiles(e.target.files);
							e.target.value = "";
						}}
					/>
					<span className="mock-pf__upicon">
						<Upload size={24} aria-hidden="true" />
					</span>
					<strong className="mock-pf__dztitle">
						{dragging
							? "Drop files to upload"
							: "Drag and drop files to upload"}
					</strong>
					<span className="mock-pf__dztext">or, click to browse</span>
					<Button
						size="sm"
						variant="secondary"
						onClick={(e) => {
							e.stopPropagation();
							fileRef.current?.click();
						}}
					>
						Select files
					</Button>
				</div>

				{entries.length ? (
					<div className="mock-pf__uplist">
						{entries.map((f) => (
							<div className="mock-pf__upfile" key={f.id}>
								<span className="mock-pf__upfileicon">
									<Paperclip size={16} aria-hidden="true" />
								</span>
								<span className="mock-pf__upfilename">{f.name}</span>
								{f.status === "uploading" ? (
									<span className="mock-pf__upprogress">
										<span className="mock-pf__uppercent">{f.progress}%</span>
										<span className="mock-pf__spinner" />
									</span>
								) : (
									<span className="mock-pf__upsize">
										{formatFileSize(f.size)}
									</span>
								)}
								<IconButton
									icon={<X />}
									label={`Remove ${f.name}`}
									variant="ghost"
									size="sm"
									onClick={() =>
										setEntries((cur) => cur.filter((e) => e.id !== f.id))
									}
								/>
							</div>
						))}
					</div>
				) : null}

				<div className="mock-pf__upfoot">
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						size="sm"
						disabled={!entries.length || uploading}
						onClick={() =>
							onDone(entries.map(({ name, size }) => ({ name, size })))
						}
					>
						{entries.length
							? `Upload ${entries.length} file${entries.length > 1 ? "s" : ""}`
							: "Upload files"}
					</Button>
				</div>
			</div>
		</div>
	);
}
