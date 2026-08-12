import { EventEmitter } from "node:events";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { BackendEventMap } from "@twodb/contracts";

type EventKey<Map> = keyof Map & string;
type AnyHandler<Map> = (
	event: EventKey<Map>,
	payload: Map[EventKey<Map>],
) => void;

/**
 * A thin typed wrapper over Node's EventEmitter. Every service plugin talks
 * to every other service plugin through this bus: events are facts named
 * `<plugin_id>.<noun>.<verb-past>`, typed by `BackendEventMap` in contracts.
 */
export class TypedBus<Map extends object> {
	private emitter = new EventEmitter();
	private anyHandlers = new Set<AnyHandler<Map>>();

	constructor() {
		this.emitter.setMaxListeners(100);
	}

	emit<K extends EventKey<Map>>(event: K, payload: Map[K]): void {
		this.emitter.emit(event, payload);
		for (const handler of this.anyHandlers)
			handler(event, payload as Map[EventKey<Map>]);
	}

	on<K extends EventKey<Map>>(
		event: K,
		handler: (payload: Map[K]) => void,
	): () => void {
		this.emitter.on(event, handler);
		return () => this.off(event, handler);
	}

	off<K extends EventKey<Map>>(
		event: K,
		handler: (payload: Map[K]) => void,
	): void {
		this.emitter.off(event, handler);
	}

	/** Observe every event on the bus (used by the realtime SSE fan-out). */
	onAny(handler: AnyHandler<Map>): () => void {
		this.anyHandlers.add(handler);
		return () => this.anyHandlers.delete(handler);
	}
}

export type BackendBus = TypedBus<BackendEventMap>;

declare module "fastify" {
	interface FastifyInstance {
		bus: BackendBus;
	}
}

/**
 * Core plugin: decorates the root fastify instance with `fastify.bus`.
 * fp-wrapped, so every service (a child scope) inherits the same bus.
 */
export const busPlugin = fp(
	async (fastify: FastifyInstance) => {
		fastify.decorate("bus", new TypedBus<BackendEventMap>());
	},
	{ name: "twodb-bus" },
);
