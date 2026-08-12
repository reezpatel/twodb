/**
 * @twodb/contracts — the single source of truth for every cross-boundary
 * message in twodb: API DTOs, bus event maps, plugin identifiers, and the
 * plugin manifest shape. Pure types plus tiny runtime helpers — no runtime
 * dependencies, so both halves of every plugin (and both hosts) can import
 * it freely without bundle contamination.
 */

/* ---------- Plugin identifiers ---------- */

/**
 * Unique dot-namespaced plugin identifier: lowercase alphanumeric segments
 * joined by dots (`twodb.notes`, `twodb.chat`, `acme.crm`). First-party
 * plugins live under the `twodb.*` namespace. The identifier is reused
 * verbatim for the API prefix, frontend route prefix, event names, exposed
 * function names, and fastify decorator keys.
 */
export type PluginId = string;

export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

export function isPluginId(value: string): value is PluginId {
	return PLUGIN_ID_PATTERN.test(value);
}

/** API mount prefix for a plugin's service routes. */
export function apiPrefix(id: PluginId): string {
	return `/api/v1/${id}`;
}

/** Frontend route prefix for a plugin's view routes. */
export function viewPrefix(id: PluginId): string {
	return `/${id}`;
}

/* ---------- Plugin manifest ---------- */

export interface PluginManifest {
	/** The unique plugin identifier, e.g. "twodb.notes". */
	id: PluginId;
	/** The package name, e.g. "@twodb/plugin-notes". */
	name: string;
	version: string;
	provides: {
		/** Function names other plugins may call, prefixed with this plugin's id. */
		functions: string[];
		/** API route prefixes this plugin serves. */
		routes: string[];
	};
	/** Bus events this plugin emits. */
	emits: string[];
	/** Bus events this plugin subscribes to. */
	consumes: string[];
	permissions: string[];
}

/* ---------- Bus event maps ---------- */

/**
 * Events emitted by service plugins on the backend bus (`fastify.bus`).
 * Naming convention: `<plugin_id>.<noun>.<verb-past>` — events are facts.
 */
export interface BackendEventMap {
	"twodb.notes.note.created": { note: Note };
	"twodb.notes.note.updated": { note: Note };
	"twodb.notes.note.deleted": { noteId: string };
}

/**
 * Events emitted by view plugins (and core shell plugins) on the frontend
 * bus. Backend events are mirrored onto the frontend bus by the realtime
 * bridge, so the full `AppEventMap` is available to views.
 */
export interface FrontendEventMap {
	"twodb.notes.note.selected": { noteId: string };
	"twodb.shell.phase.changed": { phase: "day" | "night" };
}

/** Everything a view plugin can emit or observe on the frontend bus. */
export type AppEventMap = FrontendEventMap & BackendEventMap;

/* ---------- Shared domain DTOs ---------- */

export interface CurrentUser {
	id: string;
	name: string;
}

export interface Note {
	id: string;
	title: string;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateNoteInput {
	title: string;
	body?: string;
}

export interface UpdateNoteInput {
	title?: string;
	body?: string;
}
