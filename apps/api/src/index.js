import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => {
  return { status: "ok" };
});

app.get("/api/hello", async () => {
  return {
    message: "Hello from twodb-api 👋",
    timestamp: new Date().toISOString(),
  };
});

const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
