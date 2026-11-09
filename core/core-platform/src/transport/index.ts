// @twodb/core-platform/transport
//
// GATEWAY-INTERNAL ONLY. No app links this directly — every app only ever
// talks through the Gateway over plain HTTP (see decision log). This module
// is how the Gateway (apps/twodb) dials a registered app: over a unix
// domain socket when co-located on the same machine (fastest), or over TCP/
// HTTP otherwise. The choice is invisible to the app being dialed and to
// whatever called the Gateway.

import { Agent, fetch as undiciFetch } from "undici";

export type DialTarget =
  | { kind: "http"; baseUrl: string }
  | { kind: "unix"; socketPath: string; baseUrl?: string };

export interface Dialer {
  target: DialTarget;
  /** Issues a request to the target app. Path is relative, e.g. "/threads". */
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

export function createDialer(target: DialTarget): Dialer {
  if (target.kind === "http") {
    return {
      target,
      fetch(path, init) {
        return undiciFetch(new URL(path, target.baseUrl), init as any) as unknown as Promise<Response>;
      },
    };
  }

  const agent = new Agent({ connect: { socketPath: target.socketPath } });
  const base = target.baseUrl ?? "http://unix";
  return {
    target,
    fetch(path, init) {
      return undiciFetch(new URL(path, base), { ...(init as any), dispatcher: agent }) as unknown as Promise<
        Response
      >;
    },
  };
}

/**
 * Picks unix-socket transport when both the Gateway and the target app run
 * on the same host (same `hostId`), else falls back to TCP/HTTP. Deployment
 * topology (which apps share a host) comes from TwoDB's app registry.
 */
export function pickTransport(args: {
  gatewayHostId: string;
  appHostId: string;
  appHttpUrl: string;
  appSocketPath?: string;
}): DialTarget {
  if (args.appSocketPath && args.gatewayHostId === args.appHostId) {
    return { kind: "unix", socketPath: args.appSocketPath, baseUrl: args.appHttpUrl };
  }
  return { kind: "http", baseUrl: args.appHttpUrl };
}
