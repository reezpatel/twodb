import assert from "node:assert/strict";
import { createPgDb, sql } from "@twodb/core-data/db";
import { buildServer, type ContactsDb } from "../src/server.js";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL must point to a disposable Postgres database");
const schema = `contacts_test_${Date.now()}`;
const admin = createPgDb({ connectionString: databaseUrl, schema: "public" });
await sql`create schema ${sql.id(schema)}`.execute(admin);
const db = createPgDb<ContactsDb>({ connectionString: databaseUrl, schema });
const app = await buildServer({ databaseUrl }, db);
const headers = { "x-twodb-auth-kind": "session", "x-twodb-workspace-id": "workspace-a", "x-twodb-space-ids": "space-a" };
try {
  assert.equal((await app.inject({ url: "/books" })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/books", headers, payload: { spaceId: "space-b", name: "Forbidden" } })).statusCode, 403);
  const bookResponse = await app.inject({ method: "POST", url: "/books", headers, payload: { spaceId: "space-a", name: "Friends" } });
  assert.equal(bookResponse.statusCode, 201);
  const book = bookResponse.json();
  const payload = { bookId: book.id, email: "Alice@Example.com", name: "Alice", pinned: true };
  const created = await app.inject({ method: "POST", url: "/contacts", headers, payload });
  assert.equal(created.statusCode, 201);
  const contact = created.json();
  assert.equal(contact.email, "alice@example.com");
  assert.equal((await app.inject({ method: "POST", url: "/contacts", headers, payload })).statusCode, 409);
  assert.equal((await app.inject({ method: "POST", url: "/contacts", headers, payload: { ...payload, email: "bad" } })).statusCode, 400);
  assert.equal((await app.inject({ url: "/contacts?q=ALICE", headers })).json().length, 1);
  assert.equal((await app.inject({ url: "/contacts?q=%25", headers })).json().length, 0);
  assert.equal((await app.inject({ url: "/contacts/suggest?q=alice", headers })).json().length, 1);
  for (const isolated of [{ ...headers, "x-twodb-workspace-id": "workspace-b" }, { ...headers, "x-twodb-space-ids": "space-b" }, { ...headers, "x-twodb-space-ids": "" }]) {
    assert.equal((await app.inject({ url: "/books", headers: isolated })).json().length, 0);
    assert.equal((await app.inject({ url: "/contacts", headers: isolated })).json().length, 0);
    assert.equal((await app.inject({ method: "PATCH", url: `/contacts/${contact.id}`, headers: isolated, payload: { name: "Hacked" } })).statusCode, 404);
    assert.equal((await app.inject({ method: "DELETE", url: `/contacts/${contact.id}`, headers: isolated })).statusCode, 404);
    assert.equal((await app.inject({ method: "POST", url: "/contacts", headers: isolated, payload: { ...payload, email: "other@example.com" } })).statusCode, 404);
  }
  const patched = await app.inject({ method: "PATCH", url: `/contacts/${contact.id}`, headers, payload: { notes: "Met at lunch" } });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.json().email, contact.email);
  assert.equal(patched.json().pinned, true);
  assert.equal(patched.json().notes, "Met at lunch");
  assert.equal((await app.inject({ url: "/contacts?limit=201", headers })).statusCode, 400);
  assert.equal((await app.inject({ method: "DELETE", url: `/contacts/${contact.id}`, headers })).statusCode, 200);
  assert.equal((await app.inject({ url: "/contacts", headers })).json().length, 0);
  console.log("PASS: contacts CRUD, validation, suggestions, duplicates, registration, workspace/space isolation");
} finally {
  await app.close(); await db.destroy();
  await sql`drop schema ${sql.id(schema)} cascade`.execute(admin);
  await admin.destroy();
}
