export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      detail?: string;
    } | null;
    throw new Error(body?.detail ? `${body.error ?? "Request failed"} (${res.status}): ${body.detail}` : body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
