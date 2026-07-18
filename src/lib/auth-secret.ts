const MIN_SECRET_LENGTH = 32;

/**
 * Authentication and public-link signatures must never silently fall back to a
 * known key. Failing during startup/build is safer than issuing forgeable JWTs.
 */
export function authSecretText(): string {
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must be configured with at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

export function authSecretBytes(): Uint8Array {
  return new TextEncoder().encode(authSecretText());
}
