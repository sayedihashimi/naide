import { join } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';

// AppInfo interface matching the Rust backend
export interface AppInfo {
  app_type: string;
  project_file?: string;
  command?: string;
}

// Project config structure
interface ProjectConfig {
  projectName?: string;
  lastChatSession?: string | null;
  selectedApp?: AppInfo;
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

// Load the selected app from project config
export async function loadSelectedApp(projectPath: string): Promise<AppInfo | null> {
  try {
    const configPath = await getProjectConfigPath(projectPath);
    const configExists = await exists(configPath);
    
    if (!configExists) {
      return null;
    }
    
    const content = await readTextFile(configPath);
    const config: ProjectConfig = JSON.parse(content);
    
    return config.selectedApp || null;
  } catch (error) {
    console.error('[AppSelection] Error loading selected app:', error);
    return null;
  }
}

// Save the selected app to project config
export async function saveSelectedApp(projectPath: string, app: AppInfo): Promise<void> {
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
    
    // Update selectedApp field
    config.selectedApp = app;
    
    const content = JSON.stringify(config, null, 2);
    await writeTextFile(configPath, content);
    console.log('[AppSelection] Saved selected app:', app);
  } catch (error) {
    console.error('[AppSelection] Error saving selected app:', error);
    // Don't throw - persistence is non-fatal
  }
}
