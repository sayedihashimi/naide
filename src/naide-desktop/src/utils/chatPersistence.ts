import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { getProjectPath } from './fileSystem';
import { logInfo, logError } from './logger';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  projectName: string;
  mode?: string;
  messages: ChatMessage[];
  summary?: unknown;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
}

// Get the .naide directory path within a project
async function getProjectNaideDir(projectName: string, actualPath?: string): Promise<string> {
  const projectPath = await getProjectPath(projectName, actualPath);
  const naideDir = await join(projectPath, '.naide');
  logInfo(`[ChatPersistence] getProjectNaideDir: projectName=${projectName}, actualPath=${actualPath}, projectPath=${projectPath}, naideDir=${naideDir}`);
  return naideDir;
}

// Get the chat sessions directory path
async function getChatSessionsDir(projectName: string, actualPath?: string): Promise<string> {
  const naideDir = await getProjectNaideDir(projectName, actualPath);
  return await join(naideDir, 'chatsessions');
}

// Get the project config file path (in .naide folder)
async function getProjectConfigPath(projectName: string, actualPath?: string): Promise<string> {
  const naideDir = await getProjectNaideDir(projectName, actualPath);
  return await join(naideDir, 'project-config.json');
}

// Get the default chat session filename
function getDefaultChatSessionFilename(): string {
  return 'default-chat.json';
}

// Load project config (tracks last used chat session)
async function loadProjectConfig(projectName: string, actualPath?: string): Promise<{ lastChatSession: string | null }> {
  try {
    const configPath = await getProjectConfigPath(projectName, actualPath);
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
async function saveProjectConfig(projectName: string, config: { lastChatSession: string | null }, actualPath?: string): Promise<void> {
  try {
    const naideDir = await getProjectNaideDir(projectName, actualPath);
    const naideDirExists = await exists(naideDir);
    
    if (!naideDirExists) {
      console.log('[ChatPersistence] Creating .naide directory:', naideDir);
      await mkdir(naideDir, { recursive: true });
    }
    
    const configPath = await getProjectConfigPath(projectName, actualPath);
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
export async function loadChatSession(projectName: string, sessionFilename?: string, actualPath?: string): Promise<ChatMessage[]> {
  logInfo(`[ChatPersistence] loadChatSession called with: projectName=${projectName}, sessionFilename=${sessionFilename}, actualPath=${actualPath}`);
  try {
    // Determine which session to load
    let filename = sessionFilename;
    if (!filename) {
      // Check project config for last used session
      const config = await loadProjectConfig(projectName, actualPath);
      filename = config.lastChatSession || getDefaultChatSessionFilename();
      logInfo(`[ChatPersistence] Using filename: ${filename}`);
    }
    
    const chatSessionsDir = await getChatSessionsDir(projectName, actualPath);
    const sessionPath = await join(chatSessionsDir, filename);
    logInfo(`[ChatPersistence] Attempting to load chat from: ${sessionPath}`);
    
    const sessionExists = await exists(sessionPath);
    if (!sessionExists) {
      logInfo(`[ChatPersistence] Chat session file does not exist: ${sessionPath}`);
      return [];
    }
    
    const content = await readTextFile(sessionPath);
    const session: ChatSession = JSON.parse(content);
    logInfo(`[ChatPersistence] Successfully loaded chat session: ${session.id} with ${session.messages.length} messages from: ${sessionPath}`);
    return session.messages;
  } catch (error) {
    logError(`[ChatPersistence] Error loading chat session: ${error}`);
    return [];
  }
}

// Save chat session
export async function saveChatSession(
  projectName: string,
  messages: ChatMessage[],
  sessionFilename?: string,
  actualPath?: string
): Promise<void> {
  logInfo(`[ChatPersistence] saveChatSession called with: projectName=${projectName}, messageCount=${messages.length}, sessionFilename=${sessionFilename}, actualPath=${actualPath}`);
  try {
    const filename = sessionFilename || getDefaultChatSessionFilename();
    
    // Ensure chat sessions directory exists
    const chatSessionsDir = await getChatSessionsDir(projectName, actualPath);
    logInfo(`[ChatPersistence] Chat sessions directory: ${chatSessionsDir}`);
    const chatSessionsDirExists = await exists(chatSessionsDir);
    
    if (!chatSessionsDirExists) {
      logInfo(`[ChatPersistence] Creating chat sessions directory: ${chatSessionsDir}`);
      await mkdir(chatSessionsDir, { recursive: true });
    }
    
    // Create session object
    const sessionPath = await join(chatSessionsDir, filename);
    logInfo(`[ChatPersistence] Attempting to save chat to: ${sessionPath}`);
    const sessionExists = await exists(sessionPath);
    
    let session: ChatSession;
    if (sessionExists) {
      // Update existing session
      logInfo('[ChatPersistence] Updating existing chat session');
      const existingContent = await readTextFile(sessionPath);
      const existingSession: ChatSession = JSON.parse(existingContent);
      session = {
        ...existingSession,
        messages,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Create new session
      logInfo('[ChatPersistence] Creating new chat session');
      session = {
        id: filename.replace('.json', ''),
        projectName,
        messages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    const content = JSON.stringify(session, null, 2);
    await writeTextFile(sessionPath, content);
    logInfo(`[ChatPersistence] Successfully saved chat session to: ${sessionPath} with ${messages.length} messages`);
    
    // Update project config with last used session
    await saveProjectConfig(projectName, { lastChatSession: filename }, actualPath);
  } catch (error) {
    logError(`[ChatPersistence] Error saving chat session: ${error}`);
    throw error;
  }
}

// List all chat sessions for a project
export async function listChatSessions(projectName: string, actualPath?: string): Promise<string[]> {
  try {
    const chatSessionsDir = await getChatSessionsDir(projectName, actualPath);
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

// Generate a unique chat session ID with date prefix (YYYY-MM-DD-)
function generateChatId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}-${month}-${day}`;
  
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${datePrefix}-chat-${timestamp}-${randomStr}`;
}

// Archive the current chat session by saving it with a unique ID
// Returns the archived session ID, or null if there was nothing to archive
export async function archiveChatSession(
  projectName: string,
  messages: ChatMessage[],
  mode?: string,
  summary?: unknown,
  actualPath?: string
): Promise<string | null> {
  try {
    // Filter out welcome messages (they have IDs starting with 'welcome-')
    const userMessages = messages.filter(
      (m) => m.role === 'user' || !m.id.startsWith('welcome-')
    );
    
    // Only archive if there are user messages
    const hasUserMessages = messages.some((m) => m.role === 'user');
    if (!hasUserMessages) {
      console.log('[ChatPersistence] No user messages to archive, skipping');
      return null;
    }
    
    // Generate unique ID for the archived session
    const chatId = generateChatId();
    const filename = `${chatId}.json`;
    
    // Ensure chat sessions directory exists
    const chatSessionsDir = await getChatSessionsDir(projectName, actualPath);
    const chatSessionsDirExists = await exists(chatSessionsDir);
    
    if (!chatSessionsDirExists) {
      console.log('[ChatPersistence] Creating chat sessions directory:', chatSessionsDir);
      await mkdir(chatSessionsDir, { recursive: true });
    }
    
    // Create the archived session object
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: chatId,
      projectName,
      mode,
      messages: userMessages,
      summary,
      createdAt: messages[0]?.timestamp || now,
      updatedAt: now,
      savedAt: now,
    };
    
    const sessionPath = await join(chatSessionsDir, filename);
    const content = JSON.stringify(session, null, 2);
    
    console.log('[ChatPersistence] Archiving chat session to:', sessionPath);
    await writeTextFile(sessionPath, content);
    console.log('[ChatPersistence] Chat session archived successfully with ID:', chatId);
    
    return chatId;
  } catch (error) {
    console.error('[ChatPersistence] Error archiving chat session:', error);
    throw error;
  }
}
