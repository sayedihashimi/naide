import { invoke } from '@tauri-apps/api/core';
import { 
  FileText, 
  FileCode, 
  FileJson, 
  File, 
  Folder, 
  FolderOpen, 
  Settings, 
  Globe,
  Palette,
  type LucideIcon
} from 'lucide-react';

export interface ProjectFileNode {
  name: string;
  path: string;
  is_folder: boolean;
  file_extension?: string;
}

/**
 * List immediate children of a directory in the project
 * @param projectPath - The root project path
 * @param relativePath - Optional relative path from project root (undefined = root)
 * @returns Array of file/folder nodes
 */
export async function listProjectFiles(
  projectPath: string,
  relativePath?: string
): Promise<ProjectFileNode[]> {
  try {
    const files = await invoke<ProjectFileNode[]>('list_project_files', {
      projectPath,
      relativePath: relativePath || null,
    });
    return files;
  } catch (error) {
    console.error('[projectFiles] Error listing files:', error);
    throw error;
  }
}

/**
 * Get the appropriate icon component for a file extension
 * @param extension - File extension (e.g., 'ts', 'json', 'md')
 * @param isFolder - Whether this is a folder
 * @param isFolderOpen - Whether the folder is expanded (only used if isFolder is true)
 * @returns Lucide icon component
 */
export function getFileIcon(
  extension?: string,
  isFolder?: boolean,
  isFolderOpen?: boolean
): LucideIcon {
  if (isFolder) {
    return isFolderOpen ? FolderOpen : Folder;
  }

  if (!extension) {
    return File;
  }

  const ext = extension.toLowerCase();

  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'h', 'hpp'].includes(ext)) {
    return FileCode;
  }

  // JSON files
  if (ext === 'json') {
    return FileJson;
  }

  // Markdown files
  if (ext === 'md' || ext === 'markdown') {
    return FileText;
  }

  // Config files
  if (['toml', 'yaml', 'yml', 'ini', 'conf', 'config'].includes(ext)) {
    return Settings;
  }

  // HTML files
  if (ext === 'html' || ext === 'htm') {
    return Globe;
  }

  // CSS files
  if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    return Palette;
  }

  // Default
  return File;
}

/**
 * Get a color class for a file icon based on extension
 * @param extension - File extension
 * @returns Tailwind color class
 */
export function getFileIconColor(extension?: string): string {
  if (!extension) {
    return 'text-gray-400';
  }

  const ext = extension.toLowerCase();

  // TypeScript - blue
  if (ext === 'ts' || ext === 'tsx') {
    return 'text-blue-400';
  }

  // JavaScript - yellow
  if (ext === 'js' || ext === 'jsx') {
    return 'text-yellow-400';
  }

  // Rust - orange
  if (ext === 'rs') {
    return 'text-orange-400';
  }

  // JSON - green
  if (ext === 'json') {
    return 'text-green-400';
  }

  // Markdown - gray
  if (ext === 'md' || ext === 'markdown') {
    return 'text-gray-300';
  }

  // Config - purple
  if (['toml', 'yaml', 'yml'].includes(ext)) {
    return 'text-purple-400';
  }

  // HTML - red
  if (ext === 'html' || ext === 'htm') {
    return 'text-red-400';
  }

  // CSS - pink
  if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    return 'text-pink-400';
  }

  // Python - green
  if (ext === 'py') {
    return 'text-green-500';
  }

  // Default
  return 'text-gray-400';
}
