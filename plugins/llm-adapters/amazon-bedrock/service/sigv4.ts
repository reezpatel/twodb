import { createHash, createHmac } from "node:crypto";

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type SignedRequestOptions = {
  method: string;
  url: URL;
  body: string;
  region: string;
  credentials: AwsCredentials;
};

const REGION_PATTERN = /^[a-z]{2}(-gov)?-[a-z]+-\d$/;

export function assertBedrockRegion(region: string): void {
  if (!REGION_PATTERN.test(region)) throw new Error(`invalid AWS region: ${region}`);
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

export function bedrockSignedHeaders(options: SignedRequestOptions): Record<string, string> {
  assertBedrockRegion(options.region);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: options.url.hostname,
    "x-amz-date": amzDate,
    ...(options.credentials.sessionToken ? { "x-amz-security-token": options.credentials.sessionToken } : {}),
  };

  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map((name) => `${name}:${headers[name].trim()}\n`).join("");
  const signedHeaders = signedNames.join(";");
  const canonicalRequest = [
    options.method,
    options.url.pathname || "/",
    options.url.search.replace(/^\?/, ""),
    canonicalHeaders,
    signedHeaders,
    sha256Hex(options.body),
  ].join("\n");

  const credentialScope = `${dateStamp}/${options.region}/bedrock/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${options.credentials.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, options.region);
  const kService = hmac(kRegion, "bedrock");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${options.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
