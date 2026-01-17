/**
 * Slug utilities for generating URL-safe names and timestamps
 */

/**
 * Generates a URL-safe slug from a prompt string
 * @param prompt The input prompt to convert
 * @param maxLength Maximum length of the resulting slug (default: 50)
 * @returns A lowercase kebab-case slug
 */
export function generateSlug(prompt: string, maxLength = 50): string {
  if (!prompt || prompt.trim().length === 0) {
    return 'untitled';
  }

  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, maxLength)
    .replace(/-$/, ''); // Remove trailing hyphen after truncation

  return slug || 'untitled';
}

/**
 * Generates a timestamp string in YYYY-MM-DD-HHmmss format
 * @returns Timestamp string for folder naming
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Converts an aspect ratio to a filename-safe format
 * @param ratio Aspect ratio in colon format (e.g., "16:9")
 * @returns Filename-safe format (e.g., "16x9")
 */
export function ratioToFilename(ratio: string): string {
  return ratio.replace(':', 'x');
}

/**
 * Converts a filename format back to an aspect ratio
 * @param filename Filename or path segment (e.g., "16x9" or "16x9.png")
 * @returns Aspect ratio in colon format (e.g., "16:9")
 */
export function filenameToRatio(filename: string): string {
  return filename.replace('.png', '').replace('x', ':');
}
