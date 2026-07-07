/**
 * Harness entity identifiers must start with a letter or underscore and may
 * only contain letters, digits and underscores (max 128 chars).
 */
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;

export function isValidIdentifier(identifier: string): boolean {
  return IDENTIFIER_PATTERN.test(identifier);
}

/**
 * Derives a valid Harness identifier from a display name, mirroring what the
 * Harness UI does: "My Stage" -> "My_Stage".
 */
export function toIdentifier(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 128);
  return /^[0-9]/.test(sanitized) ? `_${sanitized.slice(0, 127)}` : sanitized;
}
