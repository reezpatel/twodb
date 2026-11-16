export interface Site {
  id: string;
  spaceId: string;
  name: string;
  slug: string;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  domains: string[];
  hosts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: string;
  siteId: string;
  number: number;
  status: "draft" | "final";
  message: string | null;
  config: Record<string, unknown>;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
  finalizedAt: string | null;
  active?: boolean;
}

export interface SiteFile {
  path: string;
  size: number;
  contentType: string;
  sha256: string;
}

export interface VersionDetail extends Version {
  files: SiteFile[];
}

export interface FileContent {
  path: string;
  contentType: string;
  size: number;
  encoding: "utf8" | "base64";
  content: string;
}
