import { useState, useCallback } from "react";
import { Button } from "@twodb/ui";
import { X, Paperclip, AlertCircle } from "lucide-react";
import "./DragDropUpload.css";

interface UploadedFile {
	id: string;
	name: string;
	size: number;
	status: "uploading" | "complete" | "error";
	progress?: number;
	error?: string;
}

const INITIAL_FILES: UploadedFile[] = [
	{
		id: "1",
		name: "Website_design_brief_v4.pdf",
		size: 6.4 * 1024 * 1024,
		status: "complete",
	},
	{
		id: "2",
		name: "Website_design_inspo_v4.pdf",
		size: 2.6 * 1024 * 1024,
		status: "complete",
	},
	{
		id: "3",
		name: "Client agreement template.pdf",
		size: 4.6 * 1024 * 1024,
		status: "uploading",
		progress: 68,
	},
];

const DRAG_FILES = [
	"Website_design_brief_v4.pdf",
	"Website_design_inspo_v4.pdf",
	"Client agreement template.pdf",
];

function formatFileSize(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${bytes} B`;
}

function FileRow({
	file,
	onRemove,
}: {
	file: UploadedFile;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="mock-upload__file">
			<Paperclip size={16} className="mock-upload__file-icon" />
			<span className="mock-upload__file-name">{file.name}</span>
			{file.status === "uploading" ? (
				<div className="mock-upload__file-progress">
					<span className="mock-upload__file-percent">{file.progress}%</span>
					<div className="mock-upload__spinner" />
					<span className="mock-upload__file-size">
						{formatFileSize(file.size)}
					</span>
				</div>
			) : file.status === "error" ? (
				<div className="mock-upload__file-error">
					<AlertCircle size={14} className="mock-upload__error-icon" />
					<span className="mock-upload__file-size">
						{formatFileSize(file.size)}
					</span>
				</div>
			) : (
				<span className="mock-upload__file-size">
					{formatFileSize(file.size)}
				</span>
			)}
			<button
				type="button"
				className="mock-upload__file-remove"
				onClick={() => onRemove(file.id)}
				aria-label={`Remove ${file.name}`}
			>
				<X size={14} />
			</button>
		</div>
	);
}

function DragOverlay({ files }: { files: string[] }) {
	return (
		<div className="mock-upload__drag-overlay">
			{files.map((name, idx) => (
				<div
					key={name}
					className="mock-upload__drag-file"
					style={{ transform: `translateY(${idx * 28}px)` }}
				>
					{name}
				</div>
			))}
		</div>
	);
}

export function DragDropUploadMock() {
	const [isDragOver, setIsDragOver] = useState(false);
	const [files, setFiles] = useState<UploadedFile[]>(INITIAL_FILES);

	// Simulate upload progress
	const simulateUpload = useCallback(() => {
		const interval = setInterval(() => {
			setFiles((prevFiles) => {
				const uploadingFile = prevFiles.find((f) => f.status === "uploading");
				if (!uploadingFile || !uploadingFile.progress) {
					clearInterval(interval);
					return prevFiles;
				}
				if (uploadingFile.progress >= 100) {
					clearInterval(interval);
					return prevFiles.map((f) =>
						f.id === uploadingFile.id
							? { ...f, status: "complete", progress: undefined }
							: f,
					);
				}
				const newProgress = Math.min(
					100,
					uploadingFile.progress + Math.random() * 15,
				);
				return prevFiles.map((f) =>
					f.id === uploadingFile.id
						? { ...f, progress: Math.floor(newProgress) }
						: f,
				);
			});
		}, 300);
		return () => clearInterval(interval);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			// Simulate adding files
			setFiles((prev) => [
				...prev,
				{
					id: Date.now().toString(),
					name: "New_file.pdf",
					size: 3.2 * 1024 * 1024,
					status: "uploading",
					progress: 0,
				},
			]);
			simulateUpload();
		},
		[simulateUpload],
	);

	const handleRemove = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	const handleReset = useCallback(() => {
		setFiles([]);
	}, []);

	return (
		<div className="mock-upload">
			<div className="mock-upload__wash mock-upload__wash--a" />
			<div className="mock-upload__wash mock-upload__wash--b" />

			<div className="mock-upload__stage">
				{/* Screen 1: Empty State */}
				<div className="mock-upload__screen">
					<div className="mock-upload__dialog">
						<div className="mock-upload__header">
							<div>
								<h2 className="mock-upload__title">Create a new project</h2>
								<p className="mock-upload__description">
									Drag and drop files to create a new project.
								</p>
							</div>
							<button
								className="mock-upload__close"
								type="button"
								aria-label="Close dialog"
							>
								<X size={16} />
							</button>
						</div>

						<div
							className={`mock-upload__dropzone ${isDragOver ? "is-dragging" : ""}`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							<div className="mock-upload__dropzone-content">
								<div className="mock-upload__icon">
									<svg
										width="48"
										height="48"
										viewBox="0 0 48 48"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4Zm0 36c-8.837 0-16-7.163-16-16S15.163 8 24 8s16 7.163 16 16-7.163 16-16 16Z"
											fill="currentColor"
											opacity="0.3"
										/>
										<path
											d="M24 14c-5.523 0-10 4.477-10 10v6h-2v2h24v-2h-2v-6c0-5.523-4.477-10-10-10Zm0 4c3.314 0 6 2.686 6 6v6H18v-6c0-3.314 2.686-6 6-6Z"
											fill="currentColor"
										/>
									</svg>
								</div>
								<h3 className="mock-upload__dropzone-title">
									Drag and drop font files to upload
								</h3>
								<p className="mock-upload__dropzone-text">
									or, click to browse (4 MB max)
								</p>
								<Button size="sm" variant="secondary">
									Select files
								</Button>
							</div>
						</div>

						<div className="mock-upload__footer">
							<Button size="sm" variant="ghost" onClick={handleReset}>
								Cancel
							</Button>
							<Button size="sm" variant="primary" disabled={files.length === 0}>
								Continue
							</Button>
						</div>
					</div>
					<span className="mock-upload__screen-label">Empty state</span>
				</div>

				{/* Screen 2: Upload State */}
				<div className="mock-upload__screen mock-upload__screen--active">
					<div className="mock-upload__dialog">
						<div className="mock-upload__header">
							<div>
								<h2 className="mock-upload__title">Create a new project</h2>
								<p className="mock-upload__description">
									Drag and drop files to create a new project.
								</p>
							</div>
							<button
								className="mock-upload__close"
								type="button"
								aria-label="Close dialog"
							>
								<X size={16} />
							</button>
						</div>

						<div
							className={`mock-upload__dropzone ${isDragOver ? "is-dragging" : ""}`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							<div className="mock-upload__dropzone-content">
								<div className="mock-upload__icon">
									<svg
										width="48"
										height="48"
										viewBox="0 0 48 48"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4Zm0 36c-8.837 0-16-7.163-16-16S15.163 8 24 8s16 7.163 16 16-7.163 16-16 16Z"
											fill="currentColor"
											opacity="0.3"
										/>
										<path
											d="M24 14c-5.523 0-10 4.477-10 10v6h-2v2h24v-2h-2v-6c0-5.523-4.477-10-10-10Zm0 4c3.314 0 6 2.686 6 6v6H18v-6c0-3.314 2.686-6 6-6Z"
											fill="currentColor"
										/>
									</svg>
								</div>
								<h3 className="mock-upload__dropzone-title">
									Drag and drop font files to upload
								</h3>
								<p className="mock-upload__dropzone-text">
									or, click to browse (4 MB max)
								</p>
								<Button size="sm" variant="secondary">
									Select files
								</Button>
							</div>

							{isDragOver && <DragOverlay files={DRAG_FILES} />}
						</div>

						<div className="mock-upload__file-list">
							{files.map((file) => (
								<FileRow key={file.id} file={file} onRemove={handleRemove} />
							))}
						</div>

						<div className="mock-upload__footer">
							<Button size="sm" variant="ghost">
								Cancel
							</Button>
							<Button
								size="sm"
								variant="primary"
								disabled={files.some((f) => f.status === "uploading")}
							>
								Continue
							</Button>
						</div>
					</div>
					<span className="mock-upload__screen-label">Upload in progress</span>
				</div>

				{/* Screen 3: Error State */}
				<div className="mock-upload__screen">
					<div className="mock-upload__dialog">
						<div className="mock-upload__header">
							<div>
								<h2 className="mock-upload__title">Create a new project</h2>
								<p className="mock-upload__description">
									Drag and drop files to create a new project.
								</p>
							</div>
							<button
								className="mock-upload__close"
								type="button"
								aria-label="Close dialog"
							>
								<X size={16} />
							</button>
						</div>

						<div
							className={`mock-upload__dropzone ${isDragOver ? "is-dragging" : ""}`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							<div className="mock-upload__dropzone-content">
								<div className="mock-upload__icon">
									<svg
										width="48"
										height="48"
										viewBox="0 0 48 48"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4Zm0 36c-8.837 0-16-7.163-16-16S15.163 8 24 8s16 7.163 16 16-7.163 16-16 16Z"
											fill="currentColor"
											opacity="0.3"
										/>
										<path
											d="M24 14c-5.523 0-10 4.477-10 10v6h-2v2h24v-2h-2v-6c0-5.523-4.477-10-10-10Zm0 4c3.314 0 6 2.686 6 6v6H18v-6c0-3.314 2.686-6 6-6Z"
											fill="currentColor"
										/>
									</svg>
								</div>
								<h3 className="mock-upload__dropzone-title">
									Drag and drop font files to upload
								</h3>
								<p className="mock-upload__dropzone-text">
									or, click to browse (4 MB max)
								</p>
								<Button size="sm" variant="secondary">
									Select files
								</Button>
							</div>
						</div>

						<div className="mock-upload__file-list">
							<div className="mock-upload__file">
								<Paperclip size={16} className="mock-upload__file-icon" />
								<span className="mock-upload__file-name">
									Website_design_brief_v4.pdf
								</span>
								<div className="mock-upload__file-error">
									<AlertCircle size={14} className="mock-upload__error-icon" />
									<span className="mock-upload__file-size">6.4 MB</span>
								</div>
								<button
									type="button"
									className="mock-upload__file-remove"
									aria-label="Remove Website_design_brief_v4.pdf"
								>
									<X size={14} />
								</button>
							</div>
						</div>

						<div className="mock-upload__footer">
							<Button size="sm" variant="ghost">
								Cancel
							</Button>
							<Button size="sm" variant="primary" disabled>
								Continue
							</Button>
						</div>
					</div>
					<span className="mock-upload__screen-label">Error state</span>
				</div>
			</div>
		</div>
	);
}
