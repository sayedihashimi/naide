/**
 * Utility functions for detecting Monaco Editor language based on file names
 */

/**
 * Get the Monaco Editor language identifier based on file name
 * @param fileName - The name of the file (e.g., "App.tsx", "config.json")
 * @returns Monaco language identifier (e.g., "typescript", "json", "plaintext")
 */
export function getMonacoLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'md': 'markdown',
    'cs': 'csharp',
    'rs': 'rust',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'csproj': 'xml',
    'sln': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'sh': 'shell',
    'bash': 'shell',
    'py': 'python',
    'sql': 'sql',
    'go': 'go',
    'java': 'java',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'r': 'r',
    'dockerfile': 'dockerfile',
    'gitignore': 'plaintext',
    'env': 'plaintext',
    'log': 'plaintext',
    'txt': 'plaintext',
    'lock': 'plaintext',
  };
  
  // Check full filename for special cases
  const fullNameMap: Record<string, string> = {
    'Dockerfile': 'dockerfile',
    'Makefile': 'plaintext',
    'Cargo.toml': 'toml',
    'Cargo.lock': 'toml',
  };
  
  return fullNameMap[fileName] || languageMap[ext] || 'plaintext';
}

/**
 * Check if a file is a markdown file based on extension
 * @param fileName - The name of the file
 * @returns true if the file is a markdown file
 */
export function isMarkdownFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.md');
}

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "500 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
