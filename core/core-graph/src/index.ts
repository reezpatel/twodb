// @twodb/core-graph
//
// Thin Memgraph client wrapper (Memgraph speaks the Bolt protocol, so the
// official neo4j-driver works against it unmodified). Opt-in: only apps that
// need relationship/graph queries (TwoContacts, Garden, Paintress today)
// take this dependency — most apps never import it.

import neo4j, { type Driver, type Session, type SessionMode } from "neo4j-driver";

export interface GraphClientOptions {
  /** e.g. bolt://localhost:7687 */
  uri: string;
  user?: string;
  password?: string;
  /** Logical namespace prefix applied to every label this app writes, e.g. "twocontacts". */
  namespace: string;
}

export interface GraphClient {
  /** Run a single Cypher query and return the records as plain objects. */
  run<T = Record<string, unknown>>(cypher: string, params?: Record<string, unknown>): Promise<T[]>;
  /** Get a raw driver session for multi-statement transactions. */
  session(mode?: SessionMode): Session;
  /** Prefix a label/relationship-type with this app's namespace, e.g. ns("Person") -> "twocontacts_Person". */
  ns(label: string): string;
  close(): Promise<void>;
}

export function createGraphClient(options: GraphClientOptions): GraphClient {
  const driver: Driver = neo4j.driver(
    options.uri,
    options.user ? neo4j.auth.basic(options.user, options.password ?? "") : undefined,
  );

  function ns(label: string): string {
    return `${options.namespace}_${label}`;
  }

  return {
    async run<T>(cypher: string, params: Record<string, unknown> = {}) {
      const session = driver.session();
      try {
        const result = await session.run(cypher, params);
        return result.records.map((r) => r.toObject() as T);
      } finally {
        await session.close();
      }
    },
    session(mode: SessionMode = neo4j.session.READ) {
      return driver.session({ defaultAccessMode: mode });
    },
    ns,
    async close() {
      await driver.close();
    },
  };
}
