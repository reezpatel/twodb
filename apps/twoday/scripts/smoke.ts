import assert from "node:assert/strict";
import { createPgDb, sql } from "@twodb/core-data/db";
import { buildServer, type CalendarDb } from "../src/server.js";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("Set TEST_DATABASE_URL to a disposable Postgres database");
const schema = `day_test_${Date.now()}`;
const admin = createPgDb({connectionString:databaseUrl,schema:"public"});
await sql`create schema ${sql.id(schema)}`.execute(admin);
const db = createPgDb<CalendarDb>({connectionString:databaseUrl,schema});
const app = await buildServer({databaseUrl},db);
const headers = {"x-twodb-auth-kind":"session","x-twodb-workspace-id":"w1","x-twodb-space-ids":"s1"};
try {
  assert.equal((await app.inject({url:"/calendars"})).statusCode,401);
  assert.equal((await app.inject({method:"POST",url:"/calendars",headers,payload:{spaceId:"s2",name:"No"}})).statusCode,403);
  const cal = await app.inject({method:"POST",url:"/calendars",headers,payload:{spaceId:"s1",name:"Work"}});
  assert.equal(cal.statusCode,201);
  const payload = {calendarId:cal.json().id,title:"Meeting",startAt:"2026-03-02T10:00:00+02:00",endAt:"2026-03-02T11:00:00+02:00"};
  const created = await app.inject({method:"POST",url:"/events",headers,payload});
  assert.equal(created.statusCode,201);
  const event = created.json();
  assert.equal(event.startAt,"2026-03-02T08:00:00.000Z");
  assert.equal((await app.inject({method:"POST",url:"/events",headers,payload:{...payload,endAt:payload.startAt}})).statusCode,400);
  assert.equal((await app.inject({method:"POST",url:"/events",headers,payload:{...payload,allDay:true,startDate:"2026-03-01",endDate:"2026-03-02"}})).statusCode,400);
  const allDay = await app.inject({method:"POST",url:"/events",headers,payload:{calendarId:cal.json().id,title:"Day off",allDay:true,startDate:"2026-03-01",endDate:"2026-03-02"}});
  assert.equal(allDay.statusCode,201);
  const url = "/events?from=2026-03-02&to=2026-03-03";
  assert.equal((await app.inject({url,headers})).json().length,1);
  assert.equal((await app.inject({url:"/events?from=2026-03-01&to=2026-03-02",headers})).json().length,1);
  assert.equal((await app.inject({url:"/events?from=2026-02-30&to=2026-03-02",headers})).statusCode,400);
  assert.equal((await app.inject({url:"/events?from=2026-03-02&to=2026-03-01",headers})).statusCode,400);
  for(const isolated of [{...headers,"x-twodb-workspace-id":"w2"},{...headers,"x-twodb-space-ids":"s2"},{...headers,"x-twodb-space-ids":""}]) {
    assert.equal((await app.inject({url:"/calendars",headers:isolated})).json().length,0);
    assert.equal((await app.inject({url,headers:isolated})).json().length,0);
    assert.equal((await app.inject({method:"POST",url:"/events",headers:isolated,payload})).statusCode,404);
    assert.equal((await app.inject({method:"PUT",url:`/events/${event.id}`,headers:isolated,payload})).statusCode,404);
    assert.equal((await app.inject({method:"DELETE",url:`/events/${event.id}`,headers:isolated})).statusCode,404);
  }
  const changed = await app.inject({method:"PUT",url:`/events/${event.id}`,headers,payload:{...payload,title:"Updated"}});
  assert.equal(changed.statusCode,200); assert.equal(changed.json().title,"Updated");
  assert.equal((await app.inject({method:"DELETE",url:`/events/${event.id}`,headers})).statusCode,200);
  assert.equal((await app.inject({url,headers})).json().length,0);
  console.log("PASS: calendar/event CRUD, all-day boundaries, offset normalization, validation and tenant isolation");
} finally { await app.close(); await db.destroy(); await sql`drop schema ${sql.id(schema)} cascade`.execute(admin); await admin.destroy(); }
