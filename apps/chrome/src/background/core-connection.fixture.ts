// Test fixture: a CoreConnection on fake sockets and timers, and a scripted genuine core.
import type { CoreMessage, ProofMessage } from "@gc/protocol";
import type { ConnectionStatus } from "../shared/port-messages";
import { CoreConnection, type CoreSocket } from "./core-connection.client";
import { signProof } from "./handshake-proof.util";

export class FakeSocket implements CoreSocket {
  readonly sent: unknown[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.closed = true;
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

export const setup = () => {
  const sockets: FakeSocket[] = [];
  const statuses: ConnectionStatus[] = [];
  const messages: CoreMessage[] = [];
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const connection = new CoreConnection({
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    schedule: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  const last = (): FakeSocket => sockets[sockets.length - 1] as FakeSocket;
  return { connection, sockets, statuses, messages, timers, last };
};

export const settings = { token: "tok", port: 7341, blockedSites: [] };
export const CORE_NONCE = "a".repeat(64);

/** Resolves once `ready()` holds; WebCrypto settles on its own schedule. */
export const until = async (ready: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !ready(); i++) await Bun.sleep(1);
  if (!ready()) throw new Error("timed out");
};

/** Plays the core: sends the challenge and returns the client's proof. */
export const challenge = async (socket: FakeSocket): Promise<ProofMessage> => {
  socket.receive({ type: "challenge", nonce: CORE_NONCE });
  await until(() => socket.sent.length > 0);
  return socket.sent.at(-1) as ProofMessage;
};

/** The genuine core's `ready` for that proof, signed with `token`. */
export const readyFor = async (proof: ProofMessage, token = settings.token) => ({
  type: "ready" as const,
  proof: await signProof(token, "core", CORE_NONCE, proof.nonce),
});

/** The full handshake with a genuine core; resolves once the connection is ready. */
export const handshake = async (socket: FakeSocket, connection: CoreConnection) => {
  const ready = await readyFor(await challenge(socket));
  socket.receive(ready);
  await until(() => connection.status === "ready");
  return ready;
};
