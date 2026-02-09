import { join } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';

// JSON indentation for consistency
const JSON_INDENT = 2;

// Project config structure (same as in tabPersistence.ts)
interface ProjectConfig {
  projectName?: string;
  lastChatSession?: string | null;
  selectedApp?: {
    app_type: string;
    project_file?: string;
    command?: string;
  };
  openTabs?: unknown;
  favoriteSessions?: string[];
}

// Get the .naide directory path for a project
async function getProjectNaideDir(projectPath: string): Promise<string> {
  return await join(projectPath, '.naide');
}

// Get the project config file path
async function getProjectConfigPath(projectPath: string): Promise<string> {
  const naideDir = await getProjectNaideDir(projectPath);
  return await join(naideDir, 'project-config.json');
}

/**
 * Load the favorite sessions from project config
 * Returns an empty array if no favorites exist or if read fails
 */
export async function loadFavoriteSessions(projectPath: string): Promise<string[]> {
  try {
    const configPath = await getProjectConfigPath(projectPath);
    const configExists = await exists(configPath);
    
    if (!configExists) {
      return [];
    }
    
    const content = await readTextFile(configPath);
    const config: ProjectConfig = JSON.parse(content);
    
    return config.favoriteSessions || [];
  } catch (error) {
    console.error('[FavoritePersistence] Error loading favorite sessions:', error);
    return [];
  }
}

/**
 * Save the favorite sessions to project config
 * Merges with existing config to preserve other fields
 */
export async function saveFavoriteSessions(projectPath: string, favorites: string[]): Promise<void> {
  try {
    const naideDir = await getProjectNaideDir(projectPath);
    const naideDirExists = await exists(naideDir);
    
    if (!naideDirExists) {
      await mkdir(naideDir, { recursive: true });
    }
    
    const configPath = await getProjectConfigPath(projectPath);
    
    // Load existing config to preserve other fields
    let config: ProjectConfig = {};
    try {
      const configExists = await exists(configPath);
      if (configExists) {
        const content = await readTextFile(configPath);
        config = JSON.parse(content);
      }
    } catch {
      // Config doesn't exist or is invalid, start fresh
    }
    
    // Update favoriteSessions field
    config.favoriteSessions = favorites;
    
    const content = JSON.stringify(config, null, JSON_INDENT);
    await writeTextFile(configPath, content);
    console.log('[FavoritePersistence] Saved favorite sessions:', favorites.length);
  } catch (error) {
    console.error('[FavoritePersistence] Error saving favorite sessions:', error);
    // Don't throw - persistence is non-fatal
  }
}

/**
 * Toggle a session's favorite state
 * Adds the filename if not present, removes it if present
 * Returns the updated favorites array
 */
export async function toggleFavoriteSession(projectPath: string, filename: string): Promise<string[]> {
  const currentFavorites = await loadFavoriteSessions(projectPath);
  
  let updatedFavorites: string[];
  if (currentFavorites.includes(filename)) {
    // Remove from favorites
    updatedFavorites = currentFavorites.filter(f => f !== filename);
  } else {
    // Add to favorites
    updatedFavorites = [...currentFavorites, filename];
  }
  
  await saveFavoriteSessions(projectPath, updatedFavorites);
  return updatedFavorites;
}
