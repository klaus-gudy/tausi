import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto"

// Password hashing with Node's built-in scrypt, so no native dependency.
// Stored as "scrypt$N$r$p$salt$hash" (base64), which keeps old hashes
// verifiable if the cost parameters are raised later.

const COST = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LENGTH = 64

function derive(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, COST)
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$")
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, N, r, p, salt, hash] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !hash) return false

  const expected = Buffer.from(hash, "base64")
  const key = await derive(password, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: COST.maxmem,
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

// Hashed when an email has no account, so a failed login takes as long
// whether or not the address is registered.
let dummyHash: Promise<string> | undefined

export async function verifyNothing(password: string) {
  dummyHash ??= hashPassword("not-a-real-password")
  await verifyPassword(password, await dummyHash)
  return false
}
