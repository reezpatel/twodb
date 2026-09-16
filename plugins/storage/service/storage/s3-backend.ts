import {
	CopyObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadBucketCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PutOptions, StorageBackend, StoredObject } from "./backend";
import { contentDisposition } from "../lib/paths";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** Clients are immutable per config — reuse them across requests. */
const clientCache = new Map<string, S3Client>();

type S3Creds = {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
};

function clientFor(config: {
	region: string;
	endpoint: string | null;
	forcePathStyle: boolean;
	creds: S3Creds;
}): S3Client {
	const cacheKey = [
		config.region,
		config.endpoint ?? "",
		config.forcePathStyle ? "p" : "v",
		config.creds.accessKeyId,
	].join("|");
	let client = clientCache.get(cacheKey);
	if (!client) {
		client = new S3Client({
			region: config.region,
			endpoint: config.endpoint ?? undefined,
			forcePathStyle: config.forcePathStyle,
			credentials: {
				accessKeyId: config.creds.accessKeyId,
				secretAccessKey: config.creds.secretAccessKey,
				sessionToken: config.creds.sessionToken,
			},
		});
		clientCache.set(cacheKey, client);
	}
	return client;
}

/**
 * S3-compatible backend (AWS, MinIO, …). Objects are private — downloads go
 * through short-lived presigned GET URLs with an attachment disposition.
 */
export class S3StorageBackend implements StorageBackend {
	readonly kind = "s3" as const;

	constructor(
		private readonly client: S3Client,
		private readonly bucket: string,
		private readonly prefix: string,
	) {}

	private key(key: string): string {
		return this.prefix ? `${this.prefix}/${key}` : key;
	}

	async put(
		key: string,
		data: Buffer,
		options?: PutOptions,
	): Promise<{ etag: string | null }> {
		const result = await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: this.key(key),
				Body: data,
				ContentType: options?.contentType ?? DEFAULT_CONTENT_TYPE,
			}),
		);
		return { etag: result.ETag ?? null };
	}

	async get(key: string): Promise<StoredObject> {
		const result = await this.client.send(
			new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
		);
		const bytes = await result.Body?.transformToByteArray();
		if (!bytes) throw new Error(`s3 object "${key}" is empty`);
		return { data: Buffer.from(bytes), etag: result.ETag ?? null };
	}

	async delete(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
		);
	}

	async move(fromKey: string, toKey: string): Promise<void> {
		await this.client.send(
			new CopyObjectCommand({
				Bucket: this.bucket,
				CopySource: `${this.bucket}/${this.key(fromKey)}`,
				Key: this.key(toKey),
			}),
		);
		await this.delete(fromKey);
	}

	async deletePrefix(prefix: string): Promise<void> {
		let continuationToken: string | undefined;
		do {
			const listed = await this.client.send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: this.key(prefix),
					ContinuationToken: continuationToken,
				}),
			);
			const objects = (listed.Contents ?? [])
				.map((item) => (item.Key ? { Key: item.Key } : null))
				.filter((entry): entry is { Key: string } => entry !== null);
			for (let i = 0; i < objects.length; i += 1000) {
				await this.client.send(
					new DeleteObjectsCommand({
						Bucket: this.bucket,
						Delete: { Objects: objects.slice(i, i + 1000) },
					}),
				);
			}
			continuationToken = listed.IsTruncated
				? listed.NextContinuationToken
				: undefined;
		} while (continuationToken);
	}

	async deleteMany(keys: string[]): Promise<void> {
		for (let i = 0; i < keys.length; i += 1000) {
			await this.client.send(
				new DeleteObjectsCommand({
					Bucket: this.bucket,
					Delete: {
						Objects: keys
							.slice(i, i + 1000)
							.map((key) => ({ Key: this.key(key) })),
					},
				}),
			);
		}
	}

	async ensureDir(): Promise<void> {
		// s3 has no directories — metadata lives in the plugin's tables.
	}

	async accessUrl(
		key: string,
		options: { filename: string; expiresInSec: number },
	): Promise<string | null> {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: this.key(key),
				ResponseContentDisposition: contentDisposition(options.filename),
			}),
			{ expiresIn: options.expiresInSec },
		);
	}

	async health(): Promise<void> {
		await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
	}
}

export function s3BackendFor(config: {
	bucket: string;
	region: string;
	endpoint: string | null;
	prefix: string;
	forcePathStyle: boolean;
	creds: S3Creds;
}): S3StorageBackend {
	return new S3StorageBackend(clientFor(config), config.bucket, config.prefix);
}
