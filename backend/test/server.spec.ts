import WebSocket from "ws";
import { ChatOperations } from "./constants";
import { rec_ackMessage } from "./messageHelper";

jest.useFakeTimers();

describe("server", () => {
  let mockWebSocket: jest.Mocked<WebSocket>;
  let mockWebSocketConstructor: jest.Mock;

  beforeEach(() => {
    mockWebSocket = new WebSocket("") as jest.Mocked<WebSocket>;
    mockWebSocketConstructor = jest.fn(() => mockWebSocket);
    (global as any).WebSocket = mockWebSocketConstructor;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should register the server and send a registration message", () => {
    const serverID = "server1";
    const mockSend = jest.fn();
    mockWebSocket.send = mockSend;

    require("./server");

    jest.runOnlyPendingTimers();

    expect(mockWebSocketConstructor).toHaveBeenCalledWith("host/socket");
    expect(mockWebSocket.onclose).toBeDefined();
    expect(mockWebSocket.onerror).toBeDefined();
    expect(mockWebSocket.onopen).toBeDefined();
    expect(mockWebSocket.onmessage).toBeDefined();

    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({
        operation: ChatOperations.SERVER_REGISTER,
        payload: { serverID },
      })
    );
  });

  it("should unregister the server when receiving a self-registration request", () => {
    const mockClose = jest.fn();
    mockWebSocket.close = mockClose;

    require("./server");

    jest.runOnlyPendingTimers();

    const mockMessage = {
      data: JSON.stringify({
        operation: ChatOperations.SERVER_REQUESTED_SELF_REGISTER,
      }),
    };
    mockWebSocket.onmessage(mockMessage);

    expect(mockClose).toHaveBeenCalled();
  });

  it("should register the server when receiving a registration confirmation", () => {
    const serverID = "server1";

    require("./server");

    jest.runOnlyPendingTimers();

    const mockMessage = {
      data: JSON.stringify({
        operation: ChatOperations.SERVER_REGISTERED,
        payload: { serverID },
      }),
    };
    mockWebSocket.onmessage(mockMessage);

    expect(mockWebSocketConstructor).toHaveBeenCalledWith("host/socket");
    expect(mockWebSocket.onclose).toBeDefined();
    expect(mockWebSocket.onerror).toBeDefined();
    expect(mockWebSocket.onopen).toBeDefined();
    expect(mockWebSocket.onmessage).toBeDefined();
  });

  it("should call rec_ackMessage when receiving a placeholder message", () => {
    const serverID = "server1";
    const timestamp = 123;

    const mockRecAckMessage = jest.spyOn(rec_ackMessage, "rec_ackMessage");

    require("./server");

    jest.runOnlyPendingTimers();

    const mockMessage = {
      data: JSON.stringify({
        operation: ChatOperations.placeholder,
        payload: { timestamp },
      }),
    };
    mockWebSocket.onmessage(mockMessage);

    expect(mockRecAckMessage).toHaveBeenCalledWith(`${serverID}_${timestamp}`);
  });
});
