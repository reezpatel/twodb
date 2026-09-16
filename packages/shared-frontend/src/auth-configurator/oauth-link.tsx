export type OauthLinkProps = {
	url: string;
	label: string;
	onReveal: () => void;
};

export function OauthLink({ url, label, onReveal }: OauthLinkProps) {
	return (
		<a
			className="provider-auth__oauth-link"
			href={url}
			target="_blank"
			rel="noreferrer"
			onClick={onReveal}
		>
			{label} →
		</a>
	);
}
