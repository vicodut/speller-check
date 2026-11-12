import type { ChallengeMessage, ProofMessage, ReadyMessage } from "@gc/protocol";
import { newNonce, signProof, verifyProof } from "./handshake-proof.util";

/**
 * One socket's side of the handshake: proves the install token without sending it, and checks
 * the core proves it too. Nothing else may be sent until `verify` says yes.
 */
export class CoreHandshake {
  private nonces: { core: string; client: string } | undefined;

  constructor(private readonly token: string) {}

  /** The `proof` answering the core's challenge; undefined for any later challenge. */
  async answer(challenge: ChallengeMessage): Promise<ProofMessage | undefined> {
    if (this.nonces) return undefined;
    const nonces = { core: challenge.nonce, client: newNonce() };
    this.nonces = nonces;
    const proof = await signProof(this.token, "client", nonces.core, nonces.client);
    return { type: "proof", nonce: nonces.client, proof };
  }

  /** Whether `ready` carries the genuine core's proof over this handshake's nonces. */
  async verify(ready: ReadyMessage): Promise<boolean> {
    if (!this.nonces || !ready.proof) return false;
    const { core, client } = this.nonces;
    return verifyProof(this.token, "core", core, client, ready.proof);
  }
}
