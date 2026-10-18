import { createHash, randomBytes } from "node:crypto"

// Secret tokens for cookies and emailed links. Only the hash is stored, so a
// leaked table can't be used to sign in or accept an invitation.

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashToken(token) }
}
