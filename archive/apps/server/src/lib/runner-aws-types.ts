/** AWS bridge status shape — mirrors packages/runner-core/src/metrics/../aws.ts AwsStatus. */
export interface AwsStatus {
  installed: boolean;
  ssoSession: string | null;
  startUrl: string | null;
  ssoRegion: string | null;
  authenticated: boolean;
  tokenExpiresAt: string | null;
  profiles: { name: string; accountId?: string; roleName?: string }[];
  selectedProfile: string | null;
  error?: string;
}
