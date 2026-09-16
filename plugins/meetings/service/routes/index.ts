import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { MeetingsCtx } from "../lib/ctx";
import { registerMeetingRoutes } from "./meetings";
import { registerParticipantRoutes } from "./participants";
import { registerRecordingRoutes } from "./recordings";
import { registerSummaryRoutes } from "./summary";
import { registerTranscriptRoutes } from "./transcript";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: MeetingsCtx,
): void {
	registerMeetingRoutes(fastify, ctx);
	registerParticipantRoutes(fastify, ctx);
	registerRecordingRoutes(fastify, ctx);
	registerTranscriptRoutes(fastify, ctx);
	registerSummaryRoutes(fastify, ctx);
}
