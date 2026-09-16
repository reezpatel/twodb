import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { adminFetch, type AdminSessionState } from "../lib/admin-api";

export function useAdminSession() {
	const queryClient = useQueryClient();

	const sessionQuery = useQuery({
		queryKey: ["admin", "session"],
		queryFn: () => adminFetch<AdminSessionState>("/session"),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin"] });

	const login = useMutation({
		mutationFn: async () => {
			const optionsJSON =
				await adminFetch<PublicKeyCredentialRequestOptionsJSON>(
					"/login/options",
					{ method: "POST" },
				);
			const response = await startAuthentication({ optionsJSON });
			await adminFetch("/login/verify", { method: "POST", body: { response } });
		},
		onSuccess: invalidate,
	});

	const logout = useMutation({
		mutationFn: () => adminFetch("/logout", { method: "POST" }),
		onSuccess: invalidate,
	});

	return { sessionQuery, login, logout };
}
