export interface RegisteredAppSummary {
  slug: string;
  name: string;
  basePath: string;
  status: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const gatewayClient = {
  listApps(): Promise<RegisteredAppSummary[]> {
    return fetch("/registry/apps", { credentials: "include" }).then((r) => json(r));
  },
  provisionApp(slug: string): Promise<{ schema: string; role: string; connectionString: string }> {
    return fetch(`/registry/apps/${slug}/provision`, { method: "POST", credentials: "include" }).then((r) =>
      json(r),
    );
  },
};
