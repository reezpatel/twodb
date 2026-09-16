import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Button, Dialog, Input } from "@twodb/ui";
import { useNodeMutations } from "../hooks/use-node-mutations.hook";
import { apiErrorMessage } from "../lib/errors";
import { required } from "../lib/validators";
import { SecretReveal } from "./secret-reveal";
import { nodeCreateDialogStyles } from "./node-create-dialog.style";

type NodeCreateDialogProps = {
	open: boolean;
	onClose: () => void;
};

type CreatedNode = {
	name: string;
	secret: string;
};

function CreateNodeForm({
	onCreated,
}: {
	onCreated: (result: CreatedNode) => void;
}) {
	const { create } = useNodeMutations();

	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value }) => {
			const result = await create.mutateAsync({ name: value.name.trim() });
			onCreated({ name: result.node.name, secret: result.secret });
		},
	});

	const submitError = apiErrorMessage(create.error);

	return (
		<form
			className="node-create"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<style jsx>{nodeCreateDialogStyles}</style>
			<form.Field name="name" validators={required("Name is required")}>
				{(field) => (
					<Input
						label="Name"
						value={field.state.value}
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={field.handleBlur}
						error={field.state.meta.errors[0]?.toString()}
						placeholder="e.g. build-runner-1"
						autoFocus
					/>
				)}
			</form.Field>
			{submitError && <div className="node-create__error">{submitError}</div>}
			<div className="node-create__actions">
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Creating…" : "Create node"}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

export function NodeCreateDialog({ open, onClose }: NodeCreateDialogProps) {
	const [created, setCreated] = useState<CreatedNode | null>(null);

	useEffect(() => {
		if (!open) setCreated(null);
	}, [open]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={created ? "Node created" : "Add node"}
		>
			{created ? (
				<div className="node-create">
					<style jsx>{nodeCreateDialogStyles}</style>
					<p className="node-create__success-intro">
						<strong>{created.name}</strong> is ready. Authenticate it with this
						secret:
					</p>
					<SecretReveal plaintext={created.secret} />
					<div className="node-create__done">
						<Button variant="primary" onClick={onClose}>
							Done
						</Button>
					</div>
				</div>
			) : (
				<CreateNodeForm onCreated={setCreated} />
			)}
		</Dialog>
	);
}
