import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { adminFetch, type Passkey } from "../lib/admin-api";

export function usePasskeys() {
	const queryClient = useQueryClient();

	const passkeysQuery = useQuery({
		queryKey: ["admin", "passkeys"],
		queryFn: () => adminFetch<Passkey[]>("/passkeys"),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin"] });

	const registerPasskey = useMutation({
		mutationFn: async (name?: string) => {
			const optionsJSON =
				await adminFetch<PublicKeyCredentialCreationOptionsJSON>(
					"/passkeys/register/options",
					{ method: "POST" },
				);
			const response = await startRegistration({ optionsJSON });
			await adminFetch("/passkeys/register/verify", {
				method: "POST",
				body: { response, name },
			});
		},
		onSuccess: invalidate,
	});

	const deletePasskey = useMutation({
		mutationFn: (id: string) =>
			adminFetch(`/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" }),
		onSuccess: invalidate,
	});

	return { passkeysQuery, registerPasskey, deletePasskey };
}
