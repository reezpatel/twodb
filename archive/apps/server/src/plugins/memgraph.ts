import neo4j, { type Driver } from "neo4j-driver";

export function createGraph(url: string, user?: string, password?: string): Driver {
  const driver = user ? neo4j.driver(url, neo4j.auth.basic(user, password ?? "")) : neo4j.driver(url);
  return driver;
}
