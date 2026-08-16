export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API request failed (${status}): ${body}`);
  }
}

export class ApiClient {
  private readonly basePath: string;

  constructor(pluginId: string) {
    this.basePath = `/api/v1/${pluginId}`;
  }

  private headers(body?: unknown): Record<string, string> | undefined {
    const workspaceId =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("activeWorkspaceId")
        : null;
    if (body === undefined && !workspaceId) return undefined;
    const result: Record<string, string> = {};
    if (body !== undefined) {
      result["content-type"] = "application/json";
    }
    if (workspaceId) {
      result["x-workspace-id"] = workspaceId;
    }
    return result;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!path.startsWith("/")) {
      throw new Error(`ApiClient: path must start with /, got "${path}"`);
    }
    const url = `${this.basePath}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers(body),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }
  del(path: string, body?: unknown): Promise<void> {
    return this.request<void>("DELETE", path, body);
  }
}
