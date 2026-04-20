/**
 * Sanitizes a filename by removing special characters and replacing spaces with underscores.
 */
export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w.-]/g, '_')
    .replace(/_{2,}/g, '_');
}
