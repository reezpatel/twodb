enum ConnectionSatus {
  CONNECTED = "connected",
  CONNECTING = "connecting",
  FAILED = "failed",
  NOT_STARTED = "not_started",
}

export class ConnectionManager {
  status: ConnectionSatus = ConnectionSatus.NOT_STARTED;

  constructor(private token: string) {}

  async begin() {
    if (!this.token) {
      throw new Error("token is required for connection manager");
    }
  }

  // TODO: Websocket here..
}
