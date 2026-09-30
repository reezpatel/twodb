import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { authClient } from "../../lib/auth-client";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function useOrgPicker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const selectOrg = async (organizationId: string) => {
    setError(null);
    const { error } = await authClient.organization.setActive({
      organizationId,
    });
    if (error) {
      setError(error.message ?? "Could not select organization");
    } else {
      navigate("/");
    }
  };

  const createOrg = async (name: string) => {
    setError(null);
    const { data, error } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });
    if (error) {
      setError(error.message ?? "Could not create organization");
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    if (data) await selectOrg(data.id);
    return true;
  };

  const createForm = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      if (await createOrg(value.name)) formApi.reset();
    },
  });

  return { orgs, error, selectOrg, createOrg, createForm };
}
