import { useState } from "react";
import { useNavigate } from "react-router";
import { post } from "../../../lib/api";
import { useApiMutation, useSites } from "../../../lib/queries";
import type { Site } from "../../../lib/types";
import { errMsg } from "../../../components/Ui";

/** Holding hook for SitesPage: the space's sites + the create form. */
export function useSitesPage(spaceId: string) {
  const nav = useNavigate();
  const sites = useSites(spaceId);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");

  const create = useApiMutation(
    () => post<Site>("/sites", { spaceId, name: name.trim(), ...(domain.trim() ? { domains: [domain.trim()] } : {}) }),
    (site) => { setName(""); setDomain(""); setError(""); nav(`/s/${spaceId}/sites/${site.id}`); },
  );

  return {
    sites: sites.data ?? [],
    isLoading: sites.isLoading,
    form: { name, setName, domain, setDomain },
    canCreate: name.trim().length > 0 && !create.isPending,
    create: () => create.mutate(undefined, { onError: (e) => setError(errMsg(e)) }),
    error: error || (sites.error ? errMsg(sites.error) : ""),
  };
}
