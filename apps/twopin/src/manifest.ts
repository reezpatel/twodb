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
  url: z.string().nullable(),
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
  hasMedia: z.boolean(),
  mediaContentType: z.string().nullable(),
  heroKind: z.enum(["image", "video"]).nullable(),
  heroContentType: z.string().nullable(),
  tags: z.array(z.string()),
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
    "Lists pins in the workspace, newest first; pass `?boardId=` to scope to one board and `?tag=` to filter by a tag. " +
    "Binary assets are never inlined — use hasImage/hasFavicon/hasMedia with the /pins/:id/{image,favicon,media} endpoints.",
  request: z.object({ boardId: z.string().optional(), tag: z.string().optional() }),
  response: z.array(pin),
});

const listTags = defineEndpoint({
  name: "listTags",
  method: "GET",
  path: "/tags",
  auth: "session-or-apiKey",
  description: "Lists distinct pin tags in the workspace with counts, most-used first (for filter chips / suggestions).",
  response: z.array(z.object({ tag: z.string(), count: z.number() })),
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
    "Adds a pin to a board. Provide `url` to fetch its metadata server-side (Open Graph/Twitter Card/meta fallbacks; " +
    "redirects followed; private IPs refused; the preview image and favicon are downloaded and stored so clients " +
    "never hotlink), OR provide `mediaBase64` (image/* or video/*) for a direct media pin with no source link. " +
    "Provide both to attach media to a link. A missing scheme is assumed to be https://.",
  request: z.object({
    boardId: z.string(),
    url: z.string().nullable().optional(),
    note: z.string().optional(),
    title: z.string().optional(),
    mediaBase64: z.string().optional(),
    mediaContentType: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  response: pin,
});

const pinMedia = defineEndpoint({
  name: "pinMedia",
  method: "GET",
  path: "/pins/:id/media",
  auth: "session-or-apiKey",
  description: "Serves the pin's directly-uploaded media bytes (image or video, content-type preserved, 24h private cache). 404 when none.",
  request: z.object({ id: z.string() }),
  response: z.unknown(),
});

const uploadPinMedia = defineEndpoint({
  name: "uploadPinMedia",
  method: "POST",
  path: "/pins/:id/media",
  auth: "session-or-apiKey",
  description: "Uploads or replaces a pin's media (image/* or video/*), base64 JSON body.",
  request: z.object({ id: z.string(), mediaBase64: z.string(), mediaContentType: z.string().optional() }),
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
    tags: z.array(z.string()).optional(),
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

const bookmarkFolder = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  bookmarkCount: z.number(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

const bookmark = z.object({
  id: z.string(),
  folderId: z.string().nullable(),
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  hasFavicon: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

const listBookmarkFolders = defineEndpoint({
  name: "listBookmarkFolders",
  method: "GET",
  path: "/bookmark-folders",
  auth: "session-or-apiKey",
  description: "Lists the caller's workspace bookmark folders with bookmark counts, oldest first.",
  response: z.array(bookmarkFolder),
});

const createBookmarkFolder = defineEndpoint({
  name: "createBookmarkFolder",
  method: "POST",
  path: "/bookmark-folders",
  auth: "session-or-apiKey",
  description: "Creates a bookmark folder; pass `parentId` to nest it under another folder.",
  request: z.object({ name: z.string(), parentId: z.string().nullable().optional() }),
  response: bookmarkFolder,
});

const updateBookmarkFolder = defineEndpoint({
  name: "updateBookmarkFolder",
  method: "PATCH",
  path: "/bookmark-folders/:id",
  auth: "session-or-apiKey",
  description: "Renames a bookmark folder or moves it under another folder (`parentId`, null = top level).",
  request: z.object({ id: z.string(), name: z.string().optional(), parentId: z.string().nullable().optional() }),
  response: bookmarkFolder,
});

const deleteBookmarkFolder = defineEndpoint({
  name: "deleteBookmarkFolder",
  method: "DELETE",
  path: "/bookmark-folders/:id",
  auth: "session-or-apiKey",
  description: "Deletes a bookmark folder and all its bookmarks (cascade).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.literal(true) }),
});

const listBookmarks = defineEndpoint({
  name: "listBookmarks",
  method: "GET",
  path: "/bookmarks",
  auth: "session-or-apiKey",
  description:
    "Lists bookmarks, newest first. Pass `?folderId=<id>` for one folder or `?folderId=unfiled` for folderless bookmarks. " +
    "Binary favicons are never inlined — use hasFavicon with /bookmarks/:id/favicon.",
  request: z.object({ folderId: z.string().optional() }),
  response: z.array(bookmark),
});

const createBookmark = defineEndpoint({
  name: "createBookmark",
  method: "POST",
  path: "/bookmarks",
  auth: "session-or-apiKey",
  description:
    "Saves a bookmark. Metadata (title, description, favicon) is fetched server-side best-effort; a missing scheme " +
    "is assumed to be https://. `folderId` is optional (null = unfiled).",
  request: z.object({
    folderId: z.string().nullable().optional(),
    url: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  response: bookmark,
});

const updateBookmark = defineEndpoint({
  name: "updateBookmark",
  method: "PATCH",
  path: "/bookmarks/:id",
  auth: "session-or-apiKey",
  description: "Edits a bookmark: move folders, override title/description, or change the URL (re-fetches the favicon).",
  request: z.object({
    id: z.string(),
    folderId: z.string().nullable().optional(),
    url: z.string().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
  response: bookmark,
});

const deleteBookmark = defineEndpoint({
  name: "deleteBookmark",
  method: "DELETE",
  path: "/bookmarks/:id",
  auth: "session-or-apiKey",
  description: "Removes a bookmark.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.literal(true) }),
});

const bookmarkFavicon = defineEndpoint({
  name: "bookmarkFavicon",
  method: "GET",
  path: "/bookmarks/:id/favicon",
  auth: "session-or-apiKey",
  description: "Serves the bookmark's stored favicon bytes (content-type preserved, 24h private cache). 404 when none was fetched.",
  request: z.object({ id: z.string() }),
  response: z.unknown(),
});

const getSettings = defineEndpoint({
  name: "getSettings",
  method: "GET",
  path: "/settings",
  auth: "session-or-apiKey",
  description: "Returns the workspace's TwoPin settings (currently just the default board for the PWA share target).",
  response: z.object({ defaultBoardId: z.string().nullable() }),
});

const updateSettings = defineEndpoint({
  name: "updateSettings",
  method: "PATCH",
  path: "/settings",
  auth: "session-or-apiKey",
  description: "Sets the workspace's TwoPin settings. `defaultBoardId` is the board shared links land in.",
  request: z.object({ defaultBoardId: z.string().nullable().optional() }),
  response: z.object({ defaultBoardId: z.string().nullable() }),
});

const shareSave = defineEndpoint({
  name: "shareSave",
  method: "POST",
  path: "/share-save",
  auth: "session-or-apiKey",
  description:
    "Saves a shared URL straight into the workspace's configured default board (this is what the PWA share target " +
    "posts to). Metadata is fetched server-side. Falls back to the first board, or a lazily-created 'Shared' board.",
  request: z.object({ url: z.string(), note: z.string().optional() }),
  response: pin,
});

export const manifest = defineAppManifest({
  name: "TwoPin",
  slug: "twopin",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Pinterest-style link boards: save URLs to boards; metadata (title, description, preview image, favicon) is " +
    "fetched and stored server-side. See AGENTS.md.",
  capabilities: ["boards", "pins", "bookmarks", "link-metadata"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twopin/api",
  endpoints: [
    listBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    listPins,
    getPin,
    listTags,
    createPin,
    updatePin,
    refreshPin,
    deletePin,
    pinImage,
    pinFavicon,
    pinMedia,
    uploadPinMedia,
    previewMetadata,
    listBookmarkFolders,
    createBookmarkFolder,
    updateBookmarkFolder,
    deleteBookmarkFolder,
    listBookmarks,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    bookmarkFavicon,
    getSettings,
    updateSettings,
    shareSave,
  ],
});

export default manifest;
