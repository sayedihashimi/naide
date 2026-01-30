import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { getProjectPath } from './fileSystem';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  projectName: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// Get the .naide directory path within a project
async function getProjectNaideDir(projectName: string): Promise<string> {
  const projectPath = await getProjectPath(projectName);
  return await join(projectPath, '.naide');
}

// Get the chat sessions directory path
async function getChatSessionsDir(projectName: string): Promise<string> {
  const naideDir = await getProjectNaideDir(projectName);
  return await join(naideDir, 'chatsessions');
}

// Get the project config file path (in .naide folder)
async function getProjectConfigPath(projectName: string): Promise<string> {
  const naideDir = await getProjectNaideDir(projectName);
  return await join(naideDir, 'project-config.json');
}

// Get the default chat session filename
function getDefaultChatSessionFilename(): string {
  return 'default-chat.json';
}

// Load project config (tracks last used chat session)
async function loadProjectConfig(projectName: string): Promise<{ lastChatSession: string | null }> {
  try {
    const configPath = await getProjectConfigPath(projectName);
    const configExists = await exists(configPath);
    
    if (!configExists) {
      console.log('[ChatPersistence] No project config found, returning default');
      return { lastChatSession: null };
    }
    
    const content = await readTextFile(configPath);
    const config = JSON.parse(content);
    console.log('[ChatPersistence] Loaded project config:', config);
    return config;
  } catch (error) {
    console.error('[ChatPersistence] Error loading project config:', error);
    return { lastChatSession: null };
  }
}

// Save project config
async function saveProjectConfig(projectName: string, config: { lastChatSession: string | null }): Promise<void> {
  try {
    const naideDir = await getProjectNaideDir(projectName);
    const naideDirExists = await exists(naideDir);
    
    if (!naideDirExists) {
      console.log('[ChatPersistence] Creating .naide directory:', naideDir);
      await mkdir(naideDir, { recursive: true });
    }
    
    const configPath = await getProjectConfigPath(projectName);
    const content = JSON.stringify(config, null, 2);
    console.log('[ChatPersistence] Saving project config to:', configPath);
    await writeTextFile(configPath, content);
    console.log('[ChatPersistence] Project config saved successfully');
  } catch (error) {
    console.error('[ChatPersistence] Error saving project config:', error);
    throw error;
  }
}

// Load chat session
export async function loadChatSession(projectName: string, sessionFilename?: string): Promise<ChatMessage[]> {
  try {
    // Determine which session to load
    let filename = sessionFilename;
    if (!filename) {
      // Check project config for last used session
      const config = await loadProjectConfig(projectName);
      filename = config.lastChatSession || getDefaultChatSessionFilename();
    }
    
    const chatSessionsDir = await getChatSessionsDir(projectName);
    const sessionPath = await join(chatSessionsDir, filename);
    
    const sessionExists = await exists(sessionPath);
    if (!sessionExists) {
      console.log('[ChatPersistence] Chat session not found:', sessionPath);
      return [];
    }
    
    const content = await readTextFile(sessionPath);
    const session: ChatSession = JSON.parse(content);
    console.log('[ChatPersistence] Loaded chat session:', session.id, 'with', session.messages.length, 'messages');
    return session.messages;
  } catch (error) {
    console.error('[ChatPersistence] Error loading chat session:', error);
    return [];
  }
}

// Save chat session
export async function saveChatSession(
  projectName: string,
  messages: ChatMessage[],
  sessionFilename?: string
): Promise<void> {
  try {
    const filename = sessionFilename || getDefaultChatSessionFilename();
    
    // Ensure chat sessions directory exists
    const chatSessionsDir = await getChatSessionsDir(projectName);
    const chatSessionsDirExists = await exists(chatSessionsDir);
    
    if (!chatSessionsDirExists) {
      console.log('[ChatPersistence] Creating chat sessions directory:', chatSessionsDir);
      await mkdir(chatSessionsDir, { recursive: true });
    }
    
    // Create session object
    const sessionPath = await join(chatSessionsDir, filename);
    const sessionExists = await exists(sessionPath);
    
    let session: ChatSession;
    if (sessionExists) {
      // Update existing session
      const existingContent = await readTextFile(sessionPath);
      const existingSession: ChatSession = JSON.parse(existingContent);
      session = {
        ...existingSession,
        messages,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Create new session
      session = {
        id: filename.replace('.json', ''),
        projectName,
        messages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    const content = JSON.stringify(session, null, 2);
    console.log('[ChatPersistence] Saving chat session to:', sessionPath);
    await writeTextFile(sessionPath, content);
    console.log('[ChatPersistence] Chat session saved successfully');
    
    // Update project config with last used session
    await saveProjectConfig(projectName, { lastChatSession: filename });
  } catch (error) {
    console.error('[ChatPersistence] Error saving chat session:', error);
    throw error;
  }
}

// List all chat sessions for a project
export async function listChatSessions(projectName: string): Promise<string[]> {
  try {
    const chatSessionsDir = await getChatSessionsDir(projectName);
    const dirExists = await exists(chatSessionsDir);
    
    if (!dirExists) {
      return [];
    }
    
    // For now, return the default session if it exists
    const defaultSession = getDefaultChatSessionFilename();
    const defaultSessionPath = await join(chatSessionsDir, defaultSession);
    const defaultExists = await exists(defaultSessionPath);
    
    return defaultExists ? [defaultSession] : [];
  } catch (error) {
    console.error('[ChatPersistence] Error listing chat sessions:', error);
    return [];
  }
}
