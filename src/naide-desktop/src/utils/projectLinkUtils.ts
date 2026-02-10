/**
 * Utilities for detecting and extracting project file paths from URLs.
 * Used to intercept links in markdown that point to project files.
 */

/**
 * Check if a URL points to a project file and extract the relative path.
 * Returns the relative file path, or null if not a project link.
 * 
 * @param href - The link href to process
 * @param customDomains - Array of custom domains to recognize as project links
 * @param currentFilePath - Optional path of the markdown file containing the link (for relative link resolution)
 */
export function extractProjectFilePath(
  href: string,
  customDomains: string[],
  currentFilePath?: string | null
): string | null {
  // Check for ./ or ../ relative links first (before URL parsing)
  if (currentFilePath && (href.startsWith('./') || href.startsWith('../'))) {
    // Decode and normalize first
    let normalized = decodeURIComponent(href);
    // Strip query string and hash
    normalized = normalized.split('?')[0].split('#')[0];
    // Normalize separators
    normalized = normalized.replace(/\\/g, '/');
    
    return resolveRelativeLink(normalized, currentFilePath);
  }
  
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
      // Project-root relative path
      const normalized = decodeAndNormalizePath(href);
      return normalized;
    }
  }

  return null;
}

/**
 * Resolve a relative link based on the current file's path.
 * For example, if current file is ".prompts/features/file1.md" and link is "./file2.md",
 * returns ".prompts/features/file2.md"
 */
function resolveRelativeLink(linkPath: string, currentFilePath: string): string {
  // Get the directory of the current file
  const currentDir = currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  
  // Normalize the link path
  const normalizedLink = linkPath.replace(/\\/g, '/');
  
  // Combine the paths
  const combined = currentDir ? `${currentDir}/${normalizedLink}` : normalizedLink;
  
  // Normalize the combined path (resolve . and ..)
  return normalizePath(combined);
}

/**
 * Normalize a path by resolving . and .. segments.
 */
function normalizePath(path: string): string {
  const parts = path.split('/');
  const result: string[] = [];
  
  for (const part of parts) {
    if (part === '.' || part === '') {
      // Skip current directory references and empty parts
      continue;
    } else if (part === '..') {
      // Go up one directory
      if (result.length > 0) {
        result.pop();
      }
    } else {
      result.push(part);
    }
  }
  
  return result.join('/');
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
