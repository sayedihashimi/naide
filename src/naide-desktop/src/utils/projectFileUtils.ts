import { invoke } from '@tauri-apps/api/core';

/**
 * Read content of a project file
 * @param projectPath - The root project path
 * @param filePath - Relative path from project root
 * @returns File content as string
 */
export async function readProjectFile(
  projectPath: string,
  filePath: string
): Promise<string> {
  try {
    const content = await invoke<string>('read_project_file', {
      projectPath,
      filePath,
    });
    return content;
  } catch (error) {
    console.error('[projectFileUtils] Error reading file:', error);
    throw error;
  }
}

/**
 * Write content to a project file
 * @param projectPath - The root project path
 * @param filePath - Relative path from project root
 * @param content - Content to write
 */
export async function writeProjectFile(
  projectPath: string,
  filePath: string,
  content: string
): Promise<void> {
  try {
    await invoke('write_project_file', {
      projectPath,
      filePath,
      content,
    });
  } catch (error) {
    console.error('[projectFileUtils] Error writing file:', error);
    throw error;
  }
}
