const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "hbxhsbxdhywagdyw17267fdvsdvt";

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(text: string): Promise<string> {
  const key = await getKey(ENCRYPTION_KEY);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(text)
  );

  const encryptedContentArr = new Uint8Array(encryptedContent);
  const buf = new Uint8Array(iv.byteLength + encryptedContentArr.byteLength);
  buf.set(iv, 0);
  buf.set(encryptedContentArr, iv.byteLength);

  return btoa(String.fromCharCode.apply(null, buf as any));
}

export async function decrypt(encryptedText: string): Promise<string> {
  const key = await getKey(ENCRYPTION_KEY);
  const decoder = new TextDecoder();
  const buf = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));

  const iv = buf.slice(0, 12);
  const encryptedContent = buf.slice(12);

  const decryptedContent = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedContent
  );

  return decoder.decode(decryptedContent);
}
