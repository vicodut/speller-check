// Opt-in, macOS only: `bun run test:keychain`. Writes, reads and deletes one item under a test
// service name in the login Keychain. Never part of `bun test`. Prints pass/fail only, never a key.
import { SecurityKeychain } from "../../src/features/settings/keychain.repository";

const keychain = new SecurityKeychain("GrammarChecker API key (test)");
const id = `check-${crypto.randomUUID()}`;
const key = `sk-test-${crypto.randomUUID()}`;
const failures: string[] = [];
const expect = (name: string, pass: boolean) => {
  if (!pass) failures.push(name);
  process.stdout.write(`${pass ? "pass" : "FAIL"} ${name}\n`);
};

const missing = await keychain.get(id);
expect("a missing item reads as null", missing.ok && missing.value === null);
expect("set", (await keychain.set(id, key)).ok);
const read = await keychain.get(id);
expect("get returns the key", read.ok && read.value === key);
expect("set replaces", (await keychain.set(id, `${key}-2`)).ok);
const replaced = await keychain.get(id);
expect("get returns the new key", replaced.ok && replaced.value === `${key}-2`);
expect("remove", (await keychain.remove(id)).ok);
const gone = await keychain.get(id);
expect("removed reads as null", gone.ok && gone.value === null);
expect("removing a missing item is fine", (await keychain.remove(id)).ok);
const unsafe = await keychain.set(id, 'with "quote');
expect("an unsafe key is refused", !unsafe.ok);
process.exitCode = failures.length === 0 ? 0 : 1;
