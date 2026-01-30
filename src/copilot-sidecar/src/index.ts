import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, sep } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';

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

// Track Copilot CLI server status
let copilotServerProcess: any = null;
let copilotServerReady = false;

// Simple function to check if Copilot CLI is installed and authenticated
async function checkCopilotCLI(): Promise<{ installed: boolean; authenticated: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Check if copilot CLI is installed
    const checkProcess = spawn('which', ['copilot']);
    let installed = false;

    checkProcess.on('exit', (code) => {
      installed = code === 0;
      
      if (!installed) {
        resolve({ 
          installed: false, 
          authenticated: false, 
          error: 'Copilot CLI is not installed. Please install GitHub Copilot CLI and run `copilot` then `/login`.'
        });
        return;
      }

      // If installed, try to check auth status (simplified check)
      // In a real implementation, you'd use the Copilot SDK's auth check
      resolve({ installed: true, authenticated: true });
    });

    checkProcess.on('error', () => {
      resolve({ 
        installed: false, 
        authenticated: false, 
        error: 'Unable to check Copilot CLI installation.'
      });
    });
  });
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
  
  // For Planning mode, check Copilot CLI and call it
  if (mode === 'Planning') {
    const cliStatus = await checkCopilotCLI();
    
    if (!cliStatus.installed || !cliStatus.authenticated) {
      return res.status(400).json({
        error: cliStatus.error || 'Copilot CLI is not installed or not signed in. Please install GitHub Copilot CLI and run `copilot` then `/login`, then try again.',
        replyText: cliStatus.error || 'Copilot CLI is not installed or not signed in. Please install GitHub Copilot CLI and run `copilot` then `/login`, then try again.'
      });
    }
    
    try {
      // Load system prompts and learnings
      const systemPrompt = loadSystemPrompts(mode, workspaceRoot || process.cwd());
      const learnings = await loadLearnings(workspaceRoot || process.cwd());
      
      // For MVP, we'll simulate a Copilot response
      // In a real implementation, you would use @github/copilot-sdk here
      // This is a placeholder that shows the structure
      
      const response = {
        replyText: `I understand you want to work in Planning mode. ${message}\n\nSystem prompts loaded successfully. This is a simulated response - full Copilot SDK integration coming next.`,
        actions: []
      };
      
      return res.json(response);
    } catch (error: unknown) {
      console.error('[Sidecar] Error calling Copilot:', error);
      return res.status(500).json({
        error: 'Failed to communicate with Copilot',
        replyText: 'An error occurred while communicating with Copilot. Please try again.'
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
  res.json({ status: 'ok', copilotReady: copilotServerReady });
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Sidecar] Copilot sidecar running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Sidecar] Shutting down...');
  if (copilotServerProcess) {
    copilotServerProcess.kill();
  }
  process.exit(0);
});
