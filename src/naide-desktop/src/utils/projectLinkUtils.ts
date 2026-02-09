/**
 * Utilities for detecting and extracting project file paths from URLs.
 * Used to intercept links in markdown that point to project files.
 */

/**
 * Check if a URL points to a project file and extract the relative path.
 * Returns the relative file path, or null if not a project link.
 */
export function extractProjectFilePath(
  href: string,
  customDomains: string[]
): string | null {
  // Try parsing as absolute URL
  try {
    const url = new URL(href, window.location.href);

    // Check localhost or 127.0.0.1
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return decodeAndNormalizePath(url.pathname);
    }

    // Check custom domains (case-insensitive)
    if (customDomains.some(d => d.toLowerCase() === hostname)) {
      return decodeAndNormalizePath(url.pathname);
    }
  } catch {
    // Not a valid absolute URL — check if it looks like a relative file path
    if (isRelativeFilePath(href)) {
      return decodeAndNormalizePath(href);
    }
  }

  return null;
}

/**
 * Decode URL encoding and normalize the path for project file usage:
 * - Decodes percent-encoded characters (e.g., %20 → space)
 * - Strips leading slashes (e.g., /src/App.tsx → src/App.tsx)
 * - Strips query strings (e.g., ?v=123)
 * - Strips hash fragments (e.g., #section)
 * - Normalizes path separators to forward slashes
 * Returns null if the path is empty after processing.
 */
function decodeAndNormalizePath(urlPath: string): string | null {
  try {
    let path = decodeURIComponent(urlPath);
    // Strip leading slash
    path = path.replace(/^\/+/, '');
    // Strip query string and hash
    path = path.split('?')[0].split('#')[0];
    // Normalize separators
    path = path.replace(/\\/g, '/');

    if (!path || path === '') return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like a relative file path (not an external URL).
 */
function isRelativeFilePath(href: string): boolean {
  // Must not start with a protocol
  if (/^[a-z]+:\/\//i.test(href)) return false;
  // Must not start with # (anchor link)
  if (href.startsWith('#')) return false;
  // Must contain at least one path separator or file extension
  return href.includes('/') || href.includes('.');
}

/**
 * Determine if a file path should open as a feature-file or project-file tab.
 */
export function getTabType(relativePath: string): 'feature-file' | 'project-file' {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('.prompts/features/')) {
    return 'feature-file';
  }
  return 'project-file';
}
