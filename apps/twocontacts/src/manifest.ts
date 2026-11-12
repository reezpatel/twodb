import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

export const bookInput = z.object({ spaceId: z.string().min(1), name: z.string().trim().min(1).max(200) });
export const contactInput = z.object({
  bookId: z.string().min(1), name: z.string().trim().max(200).default(""),
  email: z.string().trim().email().max(320).transform(v => v.toLowerCase()),
  phone: z.string().trim().max(100).default(""), company: z.string().trim().max(200).default(""),
  notes: z.string().max(20000).default(""), pinned: z.boolean().default(false),
});
// Do not derive a PATCH schema from defaulted create fields: Zod applies
// those defaults even when omitted, which would erase existing values.
export const contactPatch = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).transform(v => v.toLowerCase()).optional(),
  phone: z.string().trim().max(100).optional(), company: z.string().trim().max(200).optional(),
  notes: z.string().max(20000).optional(), pinned: z.boolean().optional(),
});
const book = bookInput.extend({ id: z.string(), createdAt: z.string() });
const contact = contactInput.extend({ id: z.string(), createdAt: z.string(), updatedAt: z.string() });
export const listQuery = z.object({ bookId: z.string().optional(), q: z.string().max(200).default(""), limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).default(0) });
const auth = "session-or-apiKey" as const;
export const manifest = defineAppManifest({
  name: "TwoContacts", slug: "twocontacts", version: "0.1.0", shape: "backend+webapp",
  description: "Space-scoped address books and contacts with search and recipient suggestions.",
  capabilities: [], coreDeps: ["core-data", "core-platform", "core-async"], basePath: "/apps/twocontacts",
  endpoints: [
    defineEndpoint({ name: "listBooks", method: "GET", path: "/books", auth, description: "List address books in accessible spaces.", response: z.array(book) }),
    defineEndpoint({ name: "createBook", method: "POST", path: "/books", auth, description: "Create an address book in an accessible space.", request: bookInput, response: book }),
    defineEndpoint({ name: "listContacts", method: "GET", path: "/contacts", auth, description: "Search accessible contacts; query: bookId, q, limit (1–200), offset.", response: z.array(contact) }),
    defineEndpoint({ name: "suggestContacts", method: "GET", path: "/contacts/suggest", auth, description: "Recipient suggestions using q and optional bookId; pinned contacts first, maximum 10.", response: z.array(contact) }),
    defineEndpoint({ name: "createContact", method: "POST", path: "/contacts", auth, description: "Create a contact; normalized email must be unique in its book.", request: contactInput, response: contact }),
    defineEndpoint({ name: "updateContact", method: "PATCH", path: "/contacts/:id", auth, description: "Edit a contact in an accessible address book.", request: contactPatch, response: contact }),
    defineEndpoint({ name: "deleteContact", method: "DELETE", path: "/contacts/:id", auth, description: "Permanently delete a contact in an accessible address book.", response: z.object({ ok: z.boolean() }) }),
  ],
});
export default manifest;
