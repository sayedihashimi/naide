import { join } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';

// JSON indentation for consistency
const JSON_INDENT = 2;

// Tab info for persistence (subset of Tab interface)
export interface PersistedTab {
  id: string;
  type: 'chat' | 'feature-file' | 'project-file';
  label: string;
  filePath?: string;
  isPinned: boolean;
  isTemporary: boolean;
}

// Tabs state for persistence
export interface PersistedTabsState {
  tabs: PersistedTab[];
  activeTabId: string;
}

// Project config structure (extended from appSelection.ts)
interface ProjectConfig {
  projectName?: string;
  lastChatSession?: string | null;
  selectedApp?: {
    app_type: string;
    project_file?: string;
    command?: string;
  };
  openTabs?: PersistedTabsState;
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

// Load the open tabs from project config
export async function loadOpenTabs(projectPath: string): Promise<PersistedTabsState | null> {
  try {
    const configPath = await getProjectConfigPath(projectPath);
    const configExists = await exists(configPath);
    
    if (!configExists) {
      return null;
    }
    
    const content = await readTextFile(configPath);
    const config: ProjectConfig = JSON.parse(content);
    
    return config.openTabs || null;
  } catch (error) {
    console.error('[TabPersistence] Error loading open tabs:', error);
    return null;
  }
}

// Save the open tabs to project config
export async function saveOpenTabs(projectPath: string, tabsState: PersistedTabsState): Promise<void> {
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
    
    // Update openTabs field
    config.openTabs = tabsState;
    
    const content = JSON.stringify(config, null, JSON_INDENT);
    await writeTextFile(configPath, content);
    console.log('[TabPersistence] Saved open tabs:', tabsState.tabs.length);
  } catch (error) {
    console.error('[TabPersistence] Error saving open tabs:', error);
    // Don't throw - persistence is non-fatal
  }
}

// Clear saved tabs from project config
export async function clearOpenTabs(projectPath: string): Promise<void> {
  try {
    const configPath = await getProjectConfigPath(projectPath);
    const configExists = await exists(configPath);
    
    if (!configExists) {
      return;
    }
    
    const content = await readTextFile(configPath);
    const config: ProjectConfig = JSON.parse(content);
    
    // Remove openTabs field
    delete config.openTabs;
    
    const updatedContent = JSON.stringify(config, null, JSON_INDENT);
    await writeTextFile(configPath, updatedContent);
    console.log('[TabPersistence] Cleared open tabs');
  } catch (error) {
    console.error('[TabPersistence] Error clearing open tabs:', error);
    // Don't throw - persistence is non-fatal
  }
}
