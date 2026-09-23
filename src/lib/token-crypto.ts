import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Encrypts connection tokens (e.g. Square) before they're saved, so a leaked
 * database copy doesn't expose anyone's Square account. The key lives only in
 * the TOKEN_ENCRYPTION_KEY setting.
 */
function key(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY
  if (!secret || secret.length < 32) throw new Error("TOKEN_ENCRYPTION_KEY is missing or too short (32+ characters).")
  return createHash("sha256").update(secret).digest()
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".")
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, data] = stored.split(".")
  if (version !== "v1") throw new Error("Unknown token format")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}
