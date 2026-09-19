import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startAuthentication } from "@simplewebauthn/browser";
import { adminRepo } from "../lib/admin-api";

export function useAdminSession() {
	const queryClient = useQueryClient();

	const sessionQuery = useQuery({
		queryKey: ["admin", "session"],
		queryFn: () => adminRepo.getSession(),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin"] });

	const login = useMutation({
		mutationFn: async () => {
			const optionsJSON = await adminRepo.loginOptions();
			const response = await startAuthentication({ optionsJSON });
			await adminRepo.loginVerify(response);
		},
		onSuccess: invalidate,
	});

	const logout = useMutation({
		mutationFn: () => adminRepo.logout(),
		onSuccess: invalidate,
	});

	return { sessionQuery, login, logout };
}
