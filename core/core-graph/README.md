# @twodb/core-graph

Opt-in Memgraph client. Only import this if your app actually needs
relationship/graph queries (today: TwoContacts, Garden, Paintress). Most
apps never touch this package.

```ts
import { createGraphClient } from "@twodb/core-graph";

const graph = createGraphClient({
  uri: process.env.MEMGRAPH_URL!,
  namespace: "twocontacts",
});

const people = await graph.run(
  `MATCH (p:${graph.ns("Person")}) RETURN p LIMIT 10`,
);
```

Each app namespaces its own labels/relationship types via `graph.ns()` so
multiple apps can share one Memgraph instance without colliding — there is
no per-app "schema" concept in Memgraph the way there is in Postgres, so
namespacing by label prefix is the convention instead.
