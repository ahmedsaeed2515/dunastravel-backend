import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer | null {
  const encodedKey = process.env.PII_ENCRYPTION_KEY?.trim();
  if (!encodedKey) {
    if (['production', 'staging'].includes(process.env.NODE_ENV ?? '')) {
      throw new Error('PII_ENCRYPTION_KEY is required');
    }
    return null;
  }
  if (!/^[a-fA-F0-9]{64}$/.test(encodedKey)) {
    throw new Error('PII_ENCRYPTION_KEY must be a 64-character hex key');
  }
  return Buffer.from(encodedKey, 'hex');
}

export function generateBlindIndex(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]/g, '');
  const key = getEncryptionKey();
  if (!key) return null;
  return createHmac('sha256', key).update(normalized).digest('hex');
}

export function encryptSensitiveField(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return value;
  if (value.startsWith(ENCRYPTED_PREFIX)) return value;

  const key = getEncryptionKey();
  if (!key) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTED_PREFIX.slice(0, -1),
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSensitiveField(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return value;
  }
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    // Unencrypted legacy plaintext
    return value;
  }

  try {
    const parts = value.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      console.warn(
        '[PII_DECRYPTION_WARN] Reason=INVALID_FORMAT message="Payload prefixed with enc:v1: but invalid token structure"',
      );
      return '[REDACTED_INVALID_FORMAT]';
    }
    const key = getEncryptionKey();
    if (!key) {
      console.warn(
        '[PII_DECRYPTION_WARN] Reason=MISSING_KEY message="PII_ENCRYPTION_KEY not present in environment"',
      );
      return '[REDACTED_MISSING_KEY]';
    }
    const iv = Buffer.from(parts[2], 'base64url');
    const authTag = Buffer.from(parts[3], 'base64url');
    const ciphertext = Buffer.from(parts[4], 'base64url');
    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
      console.warn(
        '[PII_DECRYPTION_WARN] Reason=CORRUPTED_BUFFERS message="Invalid IV or AuthTag length"',
      );
      return '[REDACTED_CORRUPTED_DATA]';
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch (error: any) {
    console.warn(
      `[PII_DECRYPTION_WARN] Reason=DECRYPTION_FAILED message="GCM auth tag verification failed or key mismatch: ${error?.message}"`,
    );
    return '[REDACTED_DECRYPTION_FAILED]';
  }
}

export function encryptSensitiveJson<T>(value: T): T | string {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }
  const serialized = JSON.stringify(value);
  const encrypted = encryptSensitiveField(serialized);
  return encrypted === serialized ? value : (encrypted as string);
}

export function decryptSensitiveJson<T>(value: T): T {
  if (typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }
  const plaintext = decryptSensitiveField(value);
  if (!plaintext) return null as T;
  try {
    return JSON.parse(plaintext) as T;
  } catch {
    throw new Error('Invalid encrypted JSON field payload');
  }
}
