import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, sep } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { CopilotClient } from '@github/copilot-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Enable CORS for Tauri app
app.use(cors({
  origin: ['http://localhost:5173', 'tauri://localhost', 'http://tauri.localhost'],
  credentials: true
}));

app.use(express.json());

// Port for the sidecar API
const PORT = 3001;

// Track Copilot client
let copilotClient: CopilotClient | null = null;
let copilotReady = false;

// Initialize Copilot client
async function initializeCopilot(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Sidecar] Initializing Copilot client...');
    
    // Create client
    copilotClient = new CopilotClient({
      useLoggedInUser: true,
      autoStart: true,
      autoRestart: true,
    });
    
    // Start the client
    await copilotClient.start();
    console.log('[Sidecar] Copilot client started successfully');
    
    copilotReady = true;
    return { success: true };
  } catch (error: unknown) {
    console.error('[Sidecar] Failed to initialize Copilot:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for common error cases
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      return {
        success: false,
        error: 'Copilot CLI is not installed. Please install GitHub Copilot CLI and run `copilot` then `/login`.'
      };
    }
    
    if (errorMessage.includes('auth') || errorMessage.includes('login')) {
      return {
        success: false,
        error: 'Copilot CLI is not authenticated. Please run `copilot` then `/login`.'
      };
    }
    
    return {
      success: false,
      error: `Failed to start Copilot: ${errorMessage}`
    };
  }
}

// Load system prompts from the repository
function loadSystemPrompts(mode: string, workspaceRoot: string): string {
  const promptsDir = join(workspaceRoot, '.prompts', 'system');
  
  try {
    const basePath = join(promptsDir, 'base.system.md');
    const modePath = join(promptsDir, `${mode.toLowerCase()}.system.md`);
    
    let systemPrompt = '';
    
    if (existsSync(basePath)) {
      systemPrompt += readFileSync(basePath, 'utf-8') + '\n\n';
    }
    
    if (existsSync(modePath)) {
      systemPrompt += readFileSync(modePath, 'utf-8') + '\n\n';
    }
    
    // Add instruction to read other relevant files
    systemPrompt += `\nREQUIRED READING:\n`;
    systemPrompt += `- README.naide.md\n`;
    systemPrompt += `- .prompts/**\n`;
    systemPrompt += `- .prompts/plan/** (if exists)\n`;
    systemPrompt += `- .prompts/features/**\n`;
    systemPrompt += `- .naide/learnings/** (if exists)\n`;
    
    return systemPrompt;
  } catch (error) {
    console.error('Error loading system prompts:', error);
    return '';
  }
}

// Load learnings from .naide/learnings/
async function loadLearnings(workspaceRoot: string): Promise<string> {
  const learningsDir = join(workspaceRoot, '.naide', 'learnings');
  
  if (!existsSync(learningsDir)) {
    return '';
  }
  
  try {
    const fs = await import('fs/promises');
    const files = await fs.readdir(learningsDir);
    let learnings = '\n\n## LEARNINGS\n\n';
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(join(learningsDir, file), 'utf-8');
        learnings += `### ${file}\n${content}\n\n`;
      }
    }
    
    return learnings;
  } catch (error) {
    console.error('Error loading learnings:', error);
    return '';
  }
}

// Write a learning entry
// Note: This function is defined for future use when automatic learnings capture is implemented
function writeLearning(workspaceRoot: string, category: string, content: string): void {
  const learningsDir = join(workspaceRoot, '.naide', 'learnings');
  
  // Create directory if it doesn't exist
  if (!existsSync(learningsDir)) {
    mkdirSync(learningsDir, { recursive: true });
  }
  
  const filename = `${category}.md`;
  const filepath = join(learningsDir, filename);
  
  let existingContent = '';
  if (existsSync(filepath)) {
    existingContent = readFileSync(filepath, 'utf-8');
  }
  
  const timestamp = new Date().toISOString();
  const newEntry = `\n## [${timestamp}]\n${content}\n`;
  
  writeFileSync(filepath, existingContent + newEntry, 'utf-8');
}

// Safe file write - only allow .prompts/plan/** and .prompts/features/**
function safeFileWrite(workspaceRoot: string, relativePath: string, content: string): boolean {
  const allowedDirs = [
    join(workspaceRoot, '.prompts', 'plan'),
    join(workspaceRoot, '.prompts', 'features')
  ];
  
  // Resolve and normalize the full path to prevent path traversal
  const fullPath = join(workspaceRoot, relativePath);
  const resolvedPath = resolve(fullPath);
  
  // Check if the resolved path starts with any of the allowed directories
  const isAllowed = allowedDirs.some(dir => {
    const resolvedDir = resolve(dir);
    return resolvedPath.startsWith(resolvedDir + sep);
  });
  
  if (!isAllowed) {
    console.error(`Blocked write to disallowed path: ${relativePath}`);
    return false;
  }
  
  try {
    // Create directory if it doesn't exist
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(fullPath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing file ${relativePath}:`, error);
    return false;
  }
}

// Main chat endpoint
app.post('/api/copilot/chat', async (req, res) => {
  const { mode, message, workspaceRoot, contextFiles } = req.body;
  
  console.log(`[Sidecar] Chat request - mode: ${mode}, message: ${message?.substring(0, 50)}...`);
  
  // For Building and Analyzing modes, return stub responses
  if (mode === 'Building') {
    return res.json({
      replyText: 'Building coming soon',
      actions: []
    });
  }
  
  if (mode === 'Analyzing') {
    return res.json({
      replyText: 'Analyzing coming soon',
      actions: []
    });
  }
  
  // For Planning mode, use Copilot SDK
  if (mode === 'Planning') {
    // Check if Copilot is initialized
    if (!copilotReady || !copilotClient) {
      const initResult = await initializeCopilot();
      if (!initResult.success) {
        return res.status(400).json({
          error: initResult.error,
          replyText: initResult.error
        });
      }
    }
    
    try {
      // Load system prompts and learnings
      const systemPrompt = loadSystemPrompts(mode, workspaceRoot || process.cwd());
      const learnings = await loadLearnings(workspaceRoot || process.cwd());
      
      // Combine system prompt with learnings
      const fullSystemPrompt = systemPrompt + learnings;
      
      // Create a new session for each request to avoid conflicts
      console.log('[Sidecar] Creating new Copilot session for Planning mode');
      const session = await copilotClient!.createSession({
        model: 'gpt-4o',
        systemMessage: {
          content: fullSystemPrompt
        }
      });
      
      // Send user message and collect response
      const responseChunks: string[] = [];
      
      // Set up event listeners for the response BEFORE sending
      const responsePromise = new Promise<string>((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout;
        
        // Set up event listeners and get unsubscribe functions
        const unsubscribeAssistant = session.on('assistant.message', (event) => {
          if (event.data.content) {
            responseChunks.push(event.data.content);
          }
        });
        
        const unsubscribeIdle = session.on('session.idle', () => {
          clearTimeout(timeoutHandle);
          // Clean up listeners
          unsubscribeAssistant();
          unsubscribeIdle();
          unsubscribeError();
          
          // Destroy session after use
          session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
          
          resolve(responseChunks.join(''));
        });
        
        const unsubscribeError = session.on('session.error', (event) => {
          clearTimeout(timeoutHandle);
          // Clean up listeners
          unsubscribeAssistant();
          unsubscribeIdle();
          unsubscribeError();
          
          // Destroy session after error
          session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
          
          reject(new Error(event.data.message || 'Copilot session error'));
        });
        
        // Set timeout
        timeoutHandle = setTimeout(() => {
          // Clean up listeners on timeout
          unsubscribeAssistant();
          unsubscribeIdle();
          unsubscribeError();
          
          // Destroy session after timeout
          session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
          
          reject(new Error('Response timeout'));
        }, 60000); // 60 second timeout
      });
      
      // Send the message AFTER setting up listeners
      await session.send({ prompt: message });
      
      // Wait for the response
      const replyText = await responsePromise;
      
      const response = {
        replyText: replyText || 'No response from Copilot',
        actions: []
      };
      
      return res.json(response);
    } catch (error: unknown) {
      console.error('[Sidecar] Error calling Copilot:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        error: 'Failed to communicate with Copilot',
        replyText: `An error occurred while communicating with Copilot: ${errorMessage}`
      });
    }
  }
  
  // Unknown mode
  return res.status(400).json({
    error: `Unknown mode: ${mode}`,
    replyText: `Unknown mode: ${mode}`
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', copilotReady });
});

// Start the server and initialize Copilot
app.listen(PORT, async () => {
  console.log(`[Sidecar] Copilot sidecar running on http://localhost:${PORT}`);
  
  // Initialize Copilot on startup
  const initResult = await initializeCopilot();
  if (initResult.success) {
    console.log('[Sidecar] Copilot initialized and ready');
  } else {
    console.warn('[Sidecar] Failed to initialize Copilot on startup:', initResult.error);
    console.warn('[Sidecar] Will attempt to initialize on first request');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[Sidecar] Shutting down...');
  
  try {
    // Clean up Copilot resources
    if (copilotClient) {
      await copilotClient.stop();
      copilotClient = null;
    }
  } catch (error) {
    console.error('[Sidecar] Error during cleanup:', error);
  }
  
  process.exit(0);
});
