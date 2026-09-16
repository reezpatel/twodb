import type { Cypher } from "./cypher";

export interface StoreSaveOptions {
	ttlMs?: number;
}

export abstract class Store<
	T extends object,
	C extends object | string | Buffer = string,
> {
	constructor(protected cypher: Cypher<C>) {}

	abstract init(): Promise<void>;

	abstract save(
		scope: string,
		key: keyof T & string,
		value: C,
		options?: StoreSaveOptions,
	): Promise<void>;

	abstract get(scope: string, key: keyof T & string): Promise<C | null>;

	/** Serialized read-modify-write; implementations must lock (scope, key) across `fn`. */
	abstract modify(
		scope: string,
		key: keyof T & string,
		fn: (current: C | null) => Promise<C | null>,
	): Promise<C | null>;

	abstract delete(scope: string, key: keyof T & string): Promise<void>;

	abstract list(scope: string): Promise<string[]>;
}

type StoreEntry = { expiresAt: number | null; value: string };

export class InmemoryStore<
	T extends Record<string, string | object>,
	C extends object | string | Buffer = string | object,
> extends Store<T, C> {
	private data = new Map<string, Record<string, StoreEntry>>();

	async init(): Promise<void> {
		this.data.clear();
	}

	async save(
		scope: string,
		key: keyof T & string,
		value: C,
		options?: StoreSaveOptions,
	): Promise<void> {
		const bucket = this.bucket(scope);
		bucket[key] = {
			expiresAt: options?.ttlMs ? Date.now() + options.ttlMs : null,
			value: this.cypher.encrypt(value),
		};
	}

	async get(scope: string, key: keyof T & string): Promise<C | null> {
		const bucket = this.data.get(scope);
		if (!bucket) return null;

		const item = bucket[key];
		if (!item) return null;

		if (item.expiresAt !== null && item.expiresAt < Date.now()) {
			delete bucket[key];
			return null;
		}

		return this.cypher.decrypt(item.value);
	}

	async modify(
		scope: string,
		key: keyof T & string,
		fn: (current: C | null) => Promise<C | null>,
	): Promise<C | null> {
		const current = await this.get(scope, key);
		const next = await fn(current);
		if (next === null) {
			await this.delete(scope, key);
			return null;
		}
		await this.save(scope, key, next);
		return next;
	}

	async delete(scope: string, key: keyof T & string): Promise<void> {
		delete this.data.get(scope)?.[key];
	}

	async list(scope: string): Promise<string[]> {
		return Object.keys(this.data.get(scope) ?? {});
	}

	private bucket(scope: string): Record<string, StoreEntry> {
		let bucket = this.data.get(scope);
		if (!bucket) {
			bucket = {};
			this.data.set(scope, bucket);
		}
		return bucket;
	}
}
