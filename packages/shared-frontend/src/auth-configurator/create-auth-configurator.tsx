import type { ComponentType } from "react";
import { Button, Input, PasswordInput } from "@twodb/ui";
import { authConfiguratorStyles } from "./auth-configurator.style";
import { OauthLink } from "./oauth-link";
import type { AuthConfiguratorSpec, AuthFieldSpec } from "./spec";
import { useAuthConfigurator } from "./use-auth-configurator.hook";

export type ProviderAuthConfiguratorProps = {
	onNewAuth: (auth: Record<string, unknown>) => void;
};

const required = (message: string) => ({
	onChange: ({ value }: { value: string }) =>
		value.trim().length === 0 ? message : undefined,
});

export function createAuthConfigurator(
	spec: AuthConfiguratorSpec,
): ComponentType<ProviderAuthConfiguratorProps> {
	return function ProviderAuthConfigurator({
		onNewAuth,
	}: ProviderAuthConfiguratorProps) {
		const { form, verifyState, oauthOpen, revealOauth } = useAuthConfigurator(
			spec,
			onNewAuth,
		);

		const renderField = (
			field: AuthFieldSpec & { name: string },
			secret: boolean,
		) => (
			<form.Field
				key={field.name}
				name={field.name}
				validators={
					field.required ? required(`${field.label} is required`) : undefined
				}
			>
				{(fieldApi) => {
					const InputComponent = secret ? PasswordInput : Input;
					return (
						<InputComponent
							label={field.label}
							value={fieldApi.state.value}
							onChange={(e) => fieldApi.handleChange(e.target.value)}
							onBlur={fieldApi.handleBlur}
							error={fieldApi.state.meta.errors[0]?.toString()}
							placeholder={field.placeholder}
						/>
					);
				}}
			</form.Field>
		);

		return (
			<div className="provider-auth">
				<style jsx>{authConfiguratorStyles}</style>
				<form
					className="provider-auth__form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					{spec.apiKey &&
						renderField(
							{
								name: "api_key",
								key: "api_key",
								label: spec.apiKey.label ?? "API Key",
								required: spec.apiKey.required ?? !spec.oauth,
								placeholder: spec.apiKey.placeholder ?? "sk-...",
							},
							true,
						)}

					{(spec.fields ?? []).map((field) =>
						renderField({ ...field, name: field.key }, field.secret ?? false),
					)}

					{spec.oauth && (
						<div className="provider-auth__oauth">
							<OauthLink
								url={spec.oauth.loginUrl}
								label={spec.oauth.loginLabel ?? `Sign in with ${spec.label}`}
								onReveal={revealOauth}
							/>
							{oauthOpen &&
								spec.oauth.fields.map((field) =>
									renderField({ ...field, name: field.key }, true),
								)}
						</div>
					)}

					<div className="provider-auth__actions">
						{verifyState.ok && (
							<span className="provider-auth__verify-ok">
								✓ {verifyState.ok}
							</span>
						)}
						{verifyState.error && (
							<span className="provider-auth__verify-error">
								{verifyState.error}
							</span>
						)}
						{spec.verify !== false && (
							<Button
								variant="ghost"
								type="button"
								onClick={verifyState.run}
								disabled={verifyState.pending}
							>
								{verifyState.pending ? "Verifying…" : "Verify"}
							</Button>
						)}
						<form.Subscribe selector={(s) => s.isSubmitting}>
							{(isSubmitting) => (
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Saving…" : "Save key"}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>

				{spec.hint && (
					<p className="provider-auth__hint">
						{spec.hint.text}{" "}
						<a href={spec.hint.linkUrl} target="_blank" rel="noreferrer">
							{spec.hint.linkLabel}
						</a>
					</p>
				)}
			</div>
		);
	};
}
