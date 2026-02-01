import { invoke } from '@tauri-apps/api/core';

/**
 * Global settings management using Tauri backend.
 * Settings are stored in OS-appropriate locations (using app identifier):
 * - Windows: %AppData%\com.naide.desktop\naide-settings.json
 * - macOS: ~/Library/Application Support/com.naide.desktop/naide-settings.json
 * - Linux: ~/.config/com.naide.desktop/naide-settings.json
 */

export interface LastProject {
  path: string;
  lastAccessed: string;
}

/**
 * Save the last used project path to global settings.
 * The path must exist and be a directory.
 * @param path - Absolute path to the project directory
 */
export async function saveLastProject(path: string): Promise<void> {
  try {
    await invoke('save_last_project', { path });
    console.log('[GlobalSettings] Saved last project:', path);
  } catch (error) {
    console.error('[GlobalSettings] Error saving last project:', error);
    // Non-fatal: log but don't throw to allow app to continue
  }
}

/**
 * Load the last used project path from global settings.
 * Returns null if no project is stored or if the stored path is invalid.
 * @returns The project path if valid, or null
 */
export async function loadLastProject(): Promise<string | null> {
  try {
    const path = await invoke<string | null>('load_last_project');
    if (path) {
      console.log('[GlobalSettings] Loaded last project:', path);
    } else {
      console.log('[GlobalSettings] No valid last project found');
    }
    return path;
  } catch (error) {
    console.error('[GlobalSettings] Error loading last project:', error);
    return null;
  }
}

/**
 * Clear the last used project from global settings.
 */
export async function clearLastProject(): Promise<void> {
  try {
    await invoke('clear_last_project');
    console.log('[GlobalSettings] Cleared last project');
  } catch (error) {
    console.error('[GlobalSettings] Error clearing last project:', error);
  }
}

/**
 * Get the path to the settings file (for debugging).
 * @returns The absolute path to the settings file
 */
export async function getSettingsFilePath(): Promise<string | null> {
  try {
    const path = await invoke<string>('get_settings_file_path');
    return path;
  } catch (error) {
    console.error('[GlobalSettings] Error getting settings file path:', error);
    return null;
  }
}
