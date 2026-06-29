export function sanitizeString(input: string): string {
  if (!input) return input;
  // Strip all HTML tags and trim
  return input.replace(/<[^>]*>?/gm, '').trim();
}
