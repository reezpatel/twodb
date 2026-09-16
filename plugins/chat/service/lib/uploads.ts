import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { newId } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { ChatAttachment } from "../../shared/types";

type StorageConfig = {
	S3_ENDPOINT: string;
	S3_REGION: string;
	S3_BUCKET: string;
	S3_ACCESS_KEY_ID: string;
	S3_SECRET_ACCESS_KEY: string;
	S3_FORCE_PATH_STYLE: boolean;
};

export type AttachmentUpload = {
	attachment: ChatAttachment;
	upload: { url: string; method: "PUT"; headers: { "content-type": string } };
	expires_at: string;
};

function storageConfig(fastify: FastifyInstance): StorageConfig {
	return (fastify as FastifyInstance & { config: StorageConfig }).config;
}

function safeFilename(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-200) || "attachment";
}

export async function createAttachmentUpload(
	fastify: FastifyInstance,
	workspaceId: string,
	input: { name: string; mime_type: string; size_bytes: number },
): Promise<AttachmentUpload> {
	const config = storageConfig(fastify);
	const id = newId("chat-att");
	const storageKey = `chat/${workspaceId}/${id}/${safeFilename(input.name)}`;
	const client = new S3Client({
		endpoint: config.S3_ENDPOINT,
		region: config.S3_REGION,
		forcePathStyle: config.S3_FORCE_PATH_STYLE,
		credentials: {
			accessKeyId: config.S3_ACCESS_KEY_ID,
			secretAccessKey: config.S3_SECRET_ACCESS_KEY,
		},
	});
	const expiresIn = 15 * 60;
	const url = await getSignedUrl(
		client,
		new PutObjectCommand({
			Bucket: config.S3_BUCKET,
			Key: storageKey,
			ContentType: input.mime_type,
			ContentLength: input.size_bytes,
		}),
		{ expiresIn },
	);
	return {
		attachment: {
			id,
			name: input.name,
			mime_type: input.mime_type,
			size_bytes: input.size_bytes,
			storage_key: storageKey,
			status: "pending",
		},
		upload: {
			url,
			method: "PUT",
			headers: { "content-type": input.mime_type },
		},
		expires_at: new Date(Date.now() + expiresIn * 1_000).toISOString(),
	};
}
