import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookAck {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface HmacVerificationOptions {
  algorithm?: "sha1" | "sha256" | "sha512";
  encoding?: "hex" | "base64";
  signaturePrefix?: string;
}

export function verifySecretToken(expected: string, received?: string | null): boolean {
  if (!received) {
    return false;
  }
  return expected === received;
}

export function verifyHmacSignature(
  payload: string | Buffer,
  secret: string,
  signature: string | null | undefined,
  options: HmacVerificationOptions = {}
): boolean {
  if (!signature) {
    return false;
  }
  const algorithm = options.algorithm ?? "sha256";
  const encoding = options.encoding ?? "hex";
  const prefix = options.signaturePrefix ?? "";
  const signatureValue = signature.startsWith(prefix)
    ? signature.slice(prefix.length)
    : signature;

  const payloadBuffer = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(payload, "utf8");
  const digest = createHmac(algorithm, secret).update(payloadBuffer).digest(encoding);

  const expected = Buffer.from(digest, encoding);
  const provided = Buffer.from(signatureValue, encoding);
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}

export function ackResponse(
  statusCode = 200,
  body = "OK",
  headers: Record<string, string> = {}
): WebhookAck {
  return {
    statusCode,
    headers: { "content-type": "text/plain", ...headers },
    body,
  };
}
