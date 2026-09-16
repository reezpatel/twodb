import type { NodeDto } from "../../shared/types";

/** `last_heartbeat` is now part of NodeDto; kept here for back-compat with
 * older payloads. */
export type FleetNode = NodeDto;

export type RevealedSecret = {
	label: string | null;
	plaintext: string;
};
