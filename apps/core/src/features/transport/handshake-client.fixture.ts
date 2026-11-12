// Test fixture: the client side of the challenge/proof handshake, with a fixed client nonce.
import type { CoreMessage } from "@gc/protocol";
import { signProof } from "./handshake-proof.util";

export const CLIENT_NONCE = "c".repeat(64);

/** The `proof` message a client holding `token` sends in answer to `coreNonce`. */
export const proofFor = (token: string, coreNonce: string): string =>
  JSON.stringify({
    type: "proof",
    nonce: CLIENT_NONCE,
    proof: signProof(token, "client", coreNonce, CLIENT_NONCE),
  });

/** The proof a genuine core holding `token` sends back in `ready`. */
export const coreProofFor = (token: string, coreNonce: string): string =>
  signProof(token, "core", coreNonce, CLIENT_NONCE);

export type ProvedClient = {
  ws: WebSocket;
  /** The core's first message after the proof: `ready`, or an error. */
  reply: CoreMessage;
  /** Every message after the challenge, `reply` first. */
  received: CoreMessage[];
  /** The proof a genuine core holding `token` puts in `ready`. */
  coreProof: string;
  closed(): boolean;
};

/** Opens a WebSocket to `url` and answers the core's challenge with a proof made with `token`. */
export const connectWithProof = (url: string, token: string): Promise<ProvedClient> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const received: CoreMessage[] = [];
    let coreNonce: string | undefined;
    let closed = false;
    ws.onclose = () => {
      closed = true;
    };
    ws.onerror = () => reject(new Error("connection failed"));
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as CoreMessage;
      if (coreNonce === undefined && message.type === "challenge") {
        coreNonce = message.nonce;
        ws.send(proofFor(token, coreNonce));
        return;
      }
      received.push(message);
      if (received.length > 1 || coreNonce === undefined) return;
      const coreProof = coreProofFor(token, coreNonce);
      resolve({ ws, reply: message, received, coreProof, closed: () => closed });
    };
  });
