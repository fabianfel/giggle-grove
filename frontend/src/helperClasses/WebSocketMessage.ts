export class WebSocketMessage {
  operation: string;
  payload: {
    user?: string;
    groupname?: string;
    msg?: string;
    timestamp?: number;
    received?: boolean;
  };

  constructor(operation: string, payload: { user?: string; groupname?: string; msg?: string; timestamp?: number; received?: boolean; }) {
    this.operation = operation;
    this.payload = payload;
  }
}
