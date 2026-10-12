// Org-space selection injected into every API call — APIs opt into filtering
// on it server-side. Set by the footer spaces popover; null = all spaces.
let spaceIds: string[] | null = null;

/** Set the active space selection (null or empty = all spaces). */
export function setSpaceIds(ids: string[] | null) {
  spaceIds = ids && ids.length > 0 ? ids : null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(spaceIds ? { "x-space-ids": spaceIds.join(",") } : {}),
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