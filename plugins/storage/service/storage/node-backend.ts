import type { NodeInvokeFn } from "@twodb/contracts";
import type { StorageBackend, PutOptions, StoredObject } from "./backend";

/** generous timeouts for whole-file transfers over the gateway */
const TRANSFER_TIMEOUT_MS = 120_000;

type InvokeOptions = { timeoutMs?: number };

/**
 * Local-filesystem backend: bytes live on a node agent, reached through the
 * node plugin's root-decorated invoke. Binary payloads travel as base64
 * inside the JSON wire protocol — see NODE_MAX_FILE_BYTES.
 */
export class NodeStorageBackend implements StorageBackend {
	readonly kind = "node" as const;

	constructor(
		private readonly invoke: NodeInvokeFn,
		private readonly nodeId: string,
		private readonly rootPath: string,
	) {}

	private call<T>(
		action: string,
		payload: Record<string, unknown>,
		options?: InvokeOptions,
	): Promise<T> {
		return this.invoke(
			this.nodeId,
			action,
			{ ...payload, cwd: this.rootPath },
			options,
		) as Promise<T>;
	}

	async put(
		key: string,
		data: Buffer,
		_options?: PutOptions,
	): Promise<{ etag: string | null }> {
		await this.call(
			"write_file",
			{
				path: key,
				content: data.toString("base64"),
				encoding: "base64",
			},
			{ timeoutMs: TRANSFER_TIMEOUT_MS },
		);
		return { etag: null };
	}

	async get(key: string): Promise<StoredObject> {
		const result =
			(await this.call<{ content?: string }>(
				"read_file",
				{ path: key, encoding: "base64" },
				{ timeoutMs: TRANSFER_TIMEOUT_MS },
			)) ?? {};
		if (typeof result.content !== "string") {
			throw new Error(`node returned no content for "${key}"`);
		}
		return { data: Buffer.from(result.content, "base64"), etag: null };
	}

	async delete(key: string): Promise<void> {
		await this.call("delete_path", { path: key });
	}

	async move(fromKey: string, toKey: string): Promise<void> {
		await this.call("move_path", { from: fromKey, to: toKey });
	}

	async deletePrefix(prefix: string): Promise<void> {
		await this.call(
			"delete_path",
			{ path: prefix, recursive: true },
			{ timeoutMs: TRANSFER_TIMEOUT_MS },
		);
	}

	async deleteMany(keys: string[]): Promise<void> {
		const batch = 8;
		for (let i = 0; i < keys.length; i += batch) {
			await Promise.all(
				keys.slice(i, i + batch).map((key) => this.delete(key)),
			);
		}
	}

	async ensureDir(key: string): Promise<void> {
		await this.call("mk_dir", { path: key });
	}

	async accessUrl(): Promise<string | null> {
		return null;
	}

	async health(): Promise<void> {
		await this.call("list_dir", { path: "." });
	}
}
