import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

const board = z.object({
  id: z.string(),
  spaceId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  pinCount: z.number(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

const pin = z.object({
  id: z.string(),
  boardId: z.string(),
  url: z.string(),
  finalUrl: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  siteName: z.string().nullable(),
  status: z.enum(["pending", "ok", "error"]),
  fetchError: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  hasImage: z.boolean(),
  hasFavicon: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

const listBoards = defineEndpoint({
  name: "listBoards",
  method: "GET",
  path: "/boards",
  auth: "session-or-apiKey",
  description: "Lists the caller's workspace boards with pin counts, oldest first.",
  response: z.array(board),
});

const createBoard = defineEndpoint({
  name: "createBoard",
  method: "POST",
  path: "/boards",
  auth: "session-or-apiKey",
  description: "Creates a board. `spaceId` is optional (boards can be workspace-wide).",
  request: z.object({
    name: z.string(),
    description: z.string().optional(),
    spaceId: z.string().optional(),
  }),
  response: board,
});

const updateBoard = defineEndpoint({
  name: "updateBoard",
  method: "PATCH",
  path: "/boards/:id",
  auth: "session-or-apiKey",
  description: "Renames a board, edits its description, or moves it to a space. Only fields present are changed.",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    spaceId: z.string().nullable().optional(),
  }),
  response: board,
});

const deleteBoard = defineEndpoint({
  name: "deleteBoard",
  method: "DELETE",
  path: "/boards/:id",
  auth: "session-or-apiKey",
  description: "Deletes a board and all its pins (cascade).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.literal(true) }),
});

const listPins = defineEndpoint({
  name: "listPins",
  method: "GET",
  path: "/pins",
  auth: "session-or-apiKey",
  description:
    "Lists pins in the workspace, newest first; pass `?boardId=` to scope to one board. Binary assets are never " +
    "inlined — use hasImage/hasFavicon with the /pins/:id/image and /pins/:id/favicon endpoints.",
  request: z.object({ boardId: z.string().optional() }),
  response: z.array(pin),
});

const getPin = defineEndpoint({
  name: "getPin",
  method: "GET",
  path: "/pins/:id",
  auth: "session-or-apiKey",
  description: "Fetches one pin.",
  request: z.object({ id: z.string() }),
  response: pin,
});

const createPin = defineEndpoint({
  name: "createPin",
  method: "POST",
  path: "/pins",
  auth: "session-or-apiKey",
  description:
    "Adds a link to a board and immediately fetches its metadata server-side (Open Graph/Twitter Card/meta " +
    "fallbacks; redirects followed; private IPs refused). The preview image and favicon are downloaded and stored " +
    "so clients never hotlink. A missing scheme is assumed to be https://. The returned pin carries status " +
    "ok/error with fetchError detail — the pin is saved either way.",
  request: z.object({
    boardId: z.string(),
    url: z.string(),
    note: z.string().optional(),
  }),
  response: pin,
});

const updatePin = defineEndpoint({
  name: "updatePin",
  method: "PATCH",
  path: "/pins/:id",
  auth: "session-or-apiKey",
  description:
    "Edits a pin: move boards, override title/description, edit the note, or change the URL. Changing the URL " +
    "re-fetches metadata (overwriting title/description with fresh values).",
  request: z.object({
    id: z.string(),
    boardId: z.string().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    url: z.string().optional(),
  }),
  response: pin,
});

const refreshPin = defineEndpoint({
  name: "refreshPin",
  method: "POST",
  path: "/pins/:id/refresh",
  auth: "session-or-apiKey",
  description: "Re-fetches a pin's metadata from its URL, overwriting title/description/image/favicon with fresh values.",
  request: z.object({ id: z.string() }),
  response: pin,
});

const deletePin = defineEndpoint({
  name: "deletePin",
  method: "DELETE",
  path: "/pins/:id",
  auth: "session-or-apiKey",
  description: "Removes a pin from its board (stored image/favicon go with it).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.literal(true) }),
});

const pinImage = defineEndpoint({
  name: "pinImage",
  method: "GET",
  path: "/pins/:id/image",
  auth: "session-or-apiKey",
  description: "Serves the pin's stored preview image bytes (content-type preserved, 24h private cache). 404 when none was fetched.",
  request: z.object({ id: z.string() }),
  response: z.unknown(),
});

const pinFavicon = defineEndpoint({
  name: "pinFavicon",
  method: "GET",
  path: "/pins/:id/favicon",
  auth: "session-or-apiKey",
  description: "Serves the pin's stored favicon bytes (content-type preserved, 24h private cache). 404 when none was fetched.",
  request: z.object({ id: z.string() }),
  response: z.unknown(),
});

const previewMetadata = defineEndpoint({
  name: "previewMetadata",
  method: "POST",
  path: "/metadata/preview",
  auth: "session-or-apiKey",
  description:
    "Fetches a URL's metadata WITHOUT saving anything — powers the add-pin dialog's live preview. Images come back " +
    "as base64 data URIs (byte-capped). 422 with {ok:false, error} when the URL can't be fetched.",
  request: z.object({ url: z.string() }),
  response: z.union([
    z.object({
      ok: z.literal(true),
      finalUrl: z.string(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      siteName: z.string().nullable(),
      imageDataUri: z.string().nullable(),
      faviconDataUri: z.string().nullable(),
    }),
    z.object({ ok: z.literal(false), error: z.string() }),
  ]),
});

export const manifest = defineAppManifest({
  name: "TwoPin",
  slug: "twopin",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Pinterest-style link boards: save URLs to boards; metadata (title, description, preview image, favicon) is " +
    "fetched and stored server-side. See AGENTS.md.",
  capabilities: ["boards", "pins", "link-metadata"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twopin",
  endpoints: [
    listBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    listPins,
    getPin,
    createPin,
    updatePin,
    refreshPin,
    deletePin,
    pinImage,
    pinFavicon,
    previewMetadata,
  ],
});

export default manifest;
