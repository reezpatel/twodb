import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";
import { adminRepo } from "../lib/admin-api";

export function usePasskeys() {
  const queryClient = useQueryClient();

  const passkeysQuery = useQuery({
    queryKey: ["admin", "passkeys"],
    queryFn: () => adminRepo.listPasskeys(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const registerPasskey = useMutation({
    mutationFn: async (name?: string) => {
      const optionsJSON = await adminRepo.registerPasskeyOptions();
      const response = await startRegistration({ optionsJSON });
      await adminRepo.registerPasskeyVerify(response, name);
    },
    onSuccess: invalidate,
  });

  const deletePasskey = useMutation({
    mutationFn: (id: string) => adminRepo.deletePasskey(id),
    onSuccess: invalidate,
  });

  return { passkeysQuery, registerPasskey, deletePasskey };
}
