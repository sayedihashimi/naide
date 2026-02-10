import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, sep, relative } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { z } from 'zod';
import { initializeLogger } from './logger.js';
import { StatusEventEmitter, createStatusWebSocketServer } from './statusEvents.js';
import { proxyServer } from './proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize file logger before any other logging
initializeLogger();

// Constants
const FOOTER_MARKER = '<!-- created by naide -->';
// File write tool names from Copilot SDK's built-in tools
// These are the tools the AI uses to create/modify files
const FILE_WRITE_TOOLS = ['create', 'edit', 'write_file', 'write'];
// Command execution tool names - tools that execute terminal commands
const COMMAND_TOOLS = ['bash', 'run_command', 'execute_command', 'run_in_terminal', 'shell', 'powershell', 'terminal'];
// Streaming timeout constants
const RESPONSE_TIMEOUT_MS = 180000; // 3 minutes - initial timeout before any response
const ACTIVITY_TIMEOUT_MS = 120000; // 2 minutes - timeout once streaming starts
// Mode constants
const AUTO_MODE = 'auto';

// =============================================================================
// Types for Conversation Memory
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationSummary {
  decisions: string[];
  constraints: string[];
  acceptedDefaults: string[];
  rejectedOptions: string[];
  openQuestions: string[];
  updatedAt: string;
}

interface ConversationContext {
  summary: ConversationSummary | null;
  recentMessages: ChatMessage[];
  totalMessageCount: number;
}

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

// Create status event emitter
const statusEmitter = new StatusEventEmitter();

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

// Load system prompts from the naide app repository (not user's project)
function loadSystemPrompts(mode: string): string {
  // System prompts are in the naide app repository, not the user's project
  // When compiled, __dirname is copilot-sidecar/dist, so go up to naide root
  const naideRoot = join(__dirname, '..', '..', '..');
  const promptsDir = join(naideRoot, '.prompts', 'system');
  
  try {
    const basePath = join(promptsDir, 'base.system.md');
    
    let systemPrompt = '';
    
    // Always load base prompt
    if (existsSync(basePath)) {
      systemPrompt += readFileSync(basePath, 'utf-8') + '\n\n';
      console.log(`[Sidecar] Loaded base system prompt from: ${basePath}`);
    } else {
      console.warn(`[Sidecar] Base system prompt not found at: ${basePath}`);
    }
    
    // Handle Auto mode specially - load auto, planning, and building prompts
    if (mode.toLowerCase() === AUTO_MODE) {
      const autoPath = join(promptsDir, 'auto.system.md');
      const planningPath = join(promptsDir, 'planning.system.md');
      const buildingPath = join(promptsDir, 'building.system.md');
      
      if (existsSync(autoPath)) {
        systemPrompt += readFileSync(autoPath, 'utf-8') + '\n\n';
        console.log(`[Sidecar] Loaded auto system prompt from: ${autoPath}`);
      } else {
        console.warn(`[Sidecar] Auto system prompt not found at: ${autoPath}`);
      }
      
      if (existsSync(planningPath)) {
        systemPrompt += readFileSync(planningPath, 'utf-8') + '\n\n';
        console.log(`[Sidecar] Loaded planning system prompt from: ${planningPath}`);
      } else {
        console.warn(`[Sidecar] Planning system prompt not found at: ${planningPath}`);
      }
      
      if (existsSync(buildingPath)) {
        systemPrompt += readFileSync(buildingPath, 'utf-8') + '\n\n';
        console.log(`[Sidecar] Loaded building system prompt from: ${buildingPath}`);
      } else {
        console.warn(`[Sidecar] Building system prompt not found at: ${buildingPath}`);
      }
    } else {
      // For other modes, load the specific mode prompt
      const modePath = join(promptsDir, `${mode.toLowerCase()}.system.md`);
      
      if (existsSync(modePath)) {
        systemPrompt += readFileSync(modePath, 'utf-8') + '\n\n';
        console.log(`[Sidecar] Loaded ${mode} system prompt from: ${modePath}`);
      } else {
        console.warn(`[Sidecar] Mode system prompt not found at: ${modePath}`);
      }
    }
    
    // Add conversation memory instructions
    systemPrompt += `
CONVERSATION MEMORY INSTRUCTIONS:
You have access to conversation memory to maintain context across messages.

MEMORY STRUCTURE:
- Conversation Summary: Key decisions, constraints, accepted defaults, rejected options, and open questions
- Recent Messages: The last 6-10 messages for conversational context
- The user's message: The current request to respond to

CRITICAL RULES:
- Do NOT repeat decisions that have already been made
- Do NOT ask questions that have already been answered
- Honor all constraints and rejected options from the summary
- Build on accepted defaults rather than re-proposing alternatives
- Focus on unresolved items from the open questions list

When the conversation has matured (4+ message exchanges), include a summary update in your response using this exact format:
<!-- CONVERSATION_SUMMARY_START -->
{
  "decisions": ["New decisions from this exchange"],
  "constraints": ["New constraints identified"],
  "acceptedDefaults": ["Defaults user accepted"],
  "rejectedOptions": ["Options user rejected"],
  "openQuestions": ["Current unresolved questions - replace previous"]
}
<!-- CONVERSATION_SUMMARY_END -->

Only include non-empty arrays. The openQuestions array should contain the CURRENT state of open questions (replacing previous), while other arrays are additive (new items only).

`;

    // Add learnings tool instructions
    systemPrompt += `
PROJECT LEARNINGS INSTRUCTIONS:
You have access to the search_learnings tool to retrieve relevant learnings from past interactions.

WHEN TO USE:
- At the START of each new task, search for relevant learnings using keywords from the user's request
- When working on a topic where past decisions may be relevant
- When you need to recall previous constraints or corrections

HOW TO USE:
- Call search_learnings with an array of keywords relevant to the current task
- Example: search_learnings({ keywords: ["react", "testing"] }) for a React testing task
- Example: search_learnings({ keywords: ["api", "error", "handling"] }) for API error handling

IMPORTANT:
- Learnings contain critical corrections and constraints - always check before making significant decisions
- Apply relevant learnings to avoid repeating past mistakes
- If no learnings are found, proceed with best practices

`;
    
    return systemPrompt;
  } catch (error) {
    console.error('Error loading system prompts:', error);
    return '';
  }
}

// Search learnings from .prompts/learnings/ by keywords
// Returns learnings that match any of the provided keywords (case-insensitive)
function searchLearnings(workspaceRoot: string, keywords: string[]): string {
  const learningsDir = join(workspaceRoot, '.prompts', 'learnings');
  
  if (!existsSync(learningsDir)) {
    return 'No learnings directory found. This is a new project with no recorded learnings yet.';
  }
  
  try {
    const files = readdirSync(learningsDir).filter(f => f.endsWith('.md'));
    
    if (files.length === 0) {
      return 'No learnings found. This is a new project with no recorded learnings yet.';
    }
    
    // Normalize keywords for matching
    const normalizedKeywords = keywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 0);
    
    if (normalizedKeywords.length === 0) {
      // No keywords provided - return list of available learning files
      return `Available learning files (use specific keywords to search):\n${files.map(f => `- ${f}`).join('\n')}`;
    }
    
    // Search through learnings and score by relevance
    const matches: Array<{ file: string; content: string; score: number }> = [];
    
    for (const file of files) {
      const content = readFileSync(join(learningsDir, file), 'utf-8');
      const lowerContent = content.toLowerCase();
      const lowerFile = file.toLowerCase();
      
      // Score based on keyword matches
      let score = 0;
      for (const keyword of normalizedKeywords) {
        // Check filename (higher weight)
        if (lowerFile.includes(keyword)) {
          score += 3;
        }
        // Check content (count occurrences)
        const occurrences = (lowerContent.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        score += occurrences;
      }
      
      if (score > 0) {
        matches.push({ file, content, score });
      }
    }
    
    if (matches.length === 0) {
      return `No learnings found matching keywords: ${keywords.join(', ')}\n\nAvailable learning files:\n${files.map(f => `- ${f}`).join('\n')}`;
    }
    
    // Sort by score (highest first) and return top matches
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 5); // Limit to top 5 matches
    
    let result = `Found ${matches.length} relevant learning(s) for keywords: ${keywords.join(', ')}\n\n`;
    result += '**CRITICAL: Apply these learnings to avoid repeating past mistakes.**\n\n';
    
    for (const match of topMatches) {
      result += `### ${match.file}\n${match.content}\n\n`;
    }
    
    if (matches.length > 5) {
      result += `\n(${matches.length - 5} additional matches not shown)`;
    }
    
    return result;
  } catch (error) {
    console.error('Error searching learnings:', error);
    return 'Error searching learnings: ' + (error instanceof Error ? error.message : String(error));
  }
}

// Create the search_learnings tool for a specific workspace
function createLearningsTool(workspaceRoot: string) {
  return defineTool('search_learnings', {
    description: 'Search project learnings for relevant context based on keywords. Call this at the start of each task to find lessons from past interactions that may apply. Learnings contain important decisions, constraints, and corrections that should inform your work.',
    parameters: z.object({
      keywords: z.array(z.string()).describe('Keywords to search for in learnings (e.g., ["react", "routing"], ["api", "auth"], ["testing"]). Use terms relevant to the current task.')
    }),
    handler: async ({ keywords }) => {
      console.log(`[Sidecar] search_learnings called with keywords: ${keywords.join(', ')}`);
      const result = searchLearnings(workspaceRoot, keywords);
      return result;
    }
  });
}

// Load spec files from .prompts/plan/
function loadSpecFiles(workspaceRoot: string): string {
  const planDir = join(workspaceRoot, '.prompts', 'plan');
  
  if (!existsSync(planDir)) {
    return '';
  }
  
  try {
    const files = readdirSync(planDir);
    let specs = '\n\n## PROJECT SPECIFICATIONS\n\n';
    let hasContent = false;
    
    for (const file of files) {
      const filePath = join(planDir, file);
      if (file.endsWith('.md') || file.endsWith('.json')) {
        const content = readFileSync(filePath, 'utf-8');
        if (content.trim()) {
          specs += `### ${file}\n\`\`\`\n${content}\n\`\`\`\n\n`;
          hasContent = true;
        }
      }
    }
    
    return hasContent ? specs : '';
  } catch (error) {
    console.error('Error loading spec files:', error);
    return '';
  }
}

// Load feature files from .prompts/features/
function loadFeatureFiles(workspaceRoot: string): string {
  const featuresDir = join(workspaceRoot, '.prompts', 'features');
  
  if (!existsSync(featuresDir)) {
    return '';
  }
  
  try {
    const files = readdirSync(featuresDir);
    let features = '\n\n## FEATURE SPECIFICATIONS\n\n';
    let hasContent = false;
    
    for (const file of files) {
      // Skip removed-features directory
      if (file === 'removed-features') continue;
      
      const filePath = join(featuresDir, file);
      if (file.endsWith('.md')) {
        const content = readFileSync(filePath, 'utf-8');
        if (content.trim()) {
          features += `### ${file}\n\`\`\`\n${content}\n\`\`\`\n\n`;
          hasContent = true;
        }
      }
    }
    
    return hasContent ? features : '';
  } catch (error) {
    console.error('Error loading feature files:', error);
    return '';
  }
}

// Format conversation summary for the prompt
function formatConversationSummary(summary: ConversationSummary | null): string {
  if (!summary) {
    return '';
  }
  
  const sections: string[] = [];
  
  if (summary.decisions.length > 0) {
    sections.push(`### Key Decisions Made\n${summary.decisions.map(d => `- ${d}`).join('\n')}`);
  }
  
  if (summary.constraints.length > 0) {
    sections.push(`### Active Constraints\n${summary.constraints.map(c => `- ${c}`).join('\n')}`);
  }
  
  if (summary.acceptedDefaults.length > 0) {
    sections.push(`### Accepted Defaults\n${summary.acceptedDefaults.map(d => `- ${d}`).join('\n')}`);
  }
  
  if (summary.rejectedOptions.length > 0) {
    sections.push(`### Rejected Options (Do Not Re-propose)\n${summary.rejectedOptions.map(r => `- ${r}`).join('\n')}`);
  }
  
  if (summary.openQuestions.length > 0) {
    sections.push(`### Open Questions (Focus Here)\n${summary.openQuestions.map(q => `- ${q}`).join('\n')}`);
  }
  
  if (sections.length === 0) {
    return '';
  }
  
  return `\n\n## CONVERSATION SUMMARY (Mid-Term Memory)\n\n${sections.join('\n\n')}\n`;
}

// Format recent messages for the prompt
function formatRecentMessages(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return '';
  }
  
  const formattedMessages = messages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    // Truncate very long messages to keep token count reasonable
    const content = m.content.length > 1000 
      ? m.content.substring(0, 1000) + '... [truncated]'
      : m.content;
    return `**${role}**: ${content}`;
  });
  
  return `\n\n## RECENT CONVERSATION (Short-Term Memory)\n\n${formattedMessages.join('\n\n')}\n`;
}

/**
 * Adds the naide footer to markdown content.
 * The footer is added with two newlines before it.
 * If the content already ends with the footer, it won't be added again (idempotent).
 * 
 * @param content - The markdown content to add footer to
 * @returns The content with the footer appended
 */
function addMarkdownFooter(content: string): string {
  // If content already has the footer, don't add it again
  if (content.endsWith(FOOTER_MARKER)) {
    return content;
  }
  return content + '\n\n' + FOOTER_MARKER;
}

// Write a learning entry
// Note: This function is defined for future use when automatic learnings capture is implemented
function writeLearning(workspaceRoot: string, category: string, content: string): void {
  const learningsDir = join(workspaceRoot, '.prompts', 'learnings');
  
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
  
  const finalContent = addMarkdownFooter(existingContent + newEntry);
  writeFileSync(filepath, finalContent, 'utf-8');
}

/**
 * Convert absolute path to relative path from workspace root
 * @param workspaceRoot - The workspace root directory
 * @param filePath - The absolute or relative file path
 * @returns Relative path from workspace root
 */
function toRelativePath(workspaceRoot: string, filePath: string): string {
  // If the path is already relative (doesn't start with / or drive letter on Windows)
  if (!resolve(filePath).startsWith(resolve(workspaceRoot))) {
    // Try to resolve it relative to workspace first
    const resolvedPath = resolve(workspaceRoot, filePath);
    if (resolvedPath.startsWith(resolve(workspaceRoot))) {
      return relative(workspaceRoot, resolvedPath);
    }
    // If it's already relative and outside workspace, return as-is
    return filePath;
  }
  
  // Convert absolute path to relative
  const relativePath = relative(workspaceRoot, filePath);
  
  // If the relative path starts with '..', the file is outside workspace
  // Return the path as-is in this case
  if (relativePath.startsWith('..')) {
    return filePath;
  }
  
  return relativePath;
}

// Safe file write - allow .prompts/** and project files, but block dangerous paths
function safeFileWrite(workspaceRoot: string, relativePath: string, content: string): boolean {
  // Block dangerous paths - using precise patterns
  const blockedPatterns = [
    /(?:^|[/\\])\.\.(?:[/\\]|$)/, // Path traversal: '..' as a complete path component
    /(?:^|[/\\])node_modules(?:[/\\]|$)/, // Dependencies directory
    /(?:^|[/\\])\.git(?:[/\\]|$)/, // Git directory
    /(?:^|[/\\])\.env(?:\.|$)/, // .env files: .env, .env.local, .env.production, etc.
    /(?:^|[/\\])package\.json$/, // package.json at any depth
    /(?:^|[/\\])package-lock\.json$/, // package-lock.json at any depth
  ];
  
  if (blockedPatterns.some(pattern => pattern.test(relativePath))) {
    console.error(`Blocked write to dangerous path: ${relativePath}`);
    return false;
  }
  
  // Resolve and normalize the full path to prevent path traversal
  const fullPath = join(workspaceRoot, relativePath);
  const resolvedPath = resolve(fullPath);
  const resolvedWorkspace = resolve(workspaceRoot);
  
  // Ensure the path is within workspace
  if (!resolvedPath.startsWith(resolvedWorkspace + sep) && resolvedPath !== resolvedWorkspace) {
    console.error(`Blocked write outside workspace: ${relativePath}`);
    return false;
  }
  
  try {
    // Create directory if it doesn't exist
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    // Add footer to markdown files
    let finalContent = content;
    if (relativePath.endsWith('.md')) {
      finalContent = addMarkdownFooter(content);
    }
    
    writeFileSync(fullPath, finalContent, 'utf-8');
    console.log(`[Sidecar] Successfully wrote file: ${relativePath}`);
    return true;
  } catch (error) {
    console.error(`Error writing file ${relativePath}:`, error);
    return false;
  }
}

// Safe file read - allow reading within workspace but block dangerous paths
function safeFileRead(workspaceRoot: string, relativePath: string): string | null {
  // Block dangerous paths - using precise patterns
  const blockedPatterns = [
    /(?:^|[/\\])\.\.(?:[/\\]|$)/, // Path traversal: '..' as a complete path component
    /(?:^|[/\\])\.env(?:\.|$)/, // .env files: .env, .env.local, .env.production (may contain secrets)
  ];
  
  if (blockedPatterns.some(pattern => pattern.test(relativePath))) {
    console.error(`Blocked read from dangerous path: ${relativePath}`);
    return null;
  }
  
  // Resolve and normalize the full path to prevent path traversal
  const fullPath = join(workspaceRoot, relativePath);
  const resolvedPath = resolve(fullPath);
  const resolvedWorkspace = resolve(workspaceRoot);
  
  // Ensure the path is within workspace
  if (!resolvedPath.startsWith(resolvedWorkspace + sep) && resolvedPath !== resolvedWorkspace) {
    console.error(`Blocked read outside workspace: ${relativePath}`);
    return null;
  }
  
  try {
    if (!existsSync(fullPath)) {
      console.log(`[Sidecar] File not found: ${relativePath}`);
      return null;
    }
    
    const content = readFileSync(fullPath, 'utf-8');
    console.log(`[Sidecar] Successfully read file: ${relativePath}`);
    return content;
  } catch (error) {
    console.error(`Error reading file ${relativePath}:`, error);
    return null;
  }
}

// Streaming chat endpoint using Server-Sent Events (SSE)
app.post('/api/copilot/stream', async (req, res) => {
  const { mode, message, workspaceRoot, contextFiles, conversationContext } = req.body;
  
  console.log(`[Sidecar] Streaming chat request - mode: ${mode}, message: ${message?.substring(0, 50)}...`);
  if (conversationContext) {
    console.log(`[Sidecar] Conversation context: ${conversationContext.totalMessageCount} total messages, summary: ${conversationContext.summary ? 'yes' : 'no'}`);
  }
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if behind proxy
  
  // Helper to send SSE event
  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };
  
  // For Analyzing mode, return stub response (not ready yet)
  if (mode === 'Analyzing') {
    console.log('[Sidecar] Analyzing mode requested - returning stub response');
    sendEvent('delta', { content: 'Analyzing coming soon' });
    sendEvent('done', {});
    res.end();
    return;
  }
  
  // For Auto, Planning and Building modes, use Copilot SDK with streaming
  if (mode === 'Auto' || mode === 'Planning' || mode === 'Building') {
    console.log(`[Sidecar] Starting streaming request for ${mode} mode`);
    console.log(`[Sidecar] Message: ${message?.substring(0, 100)}${message && message.length > 100 ? '...' : ''}`);
    console.log(`[Sidecar] Workspace: ${workspaceRoot || 'not specified'}`);
    if (conversationContext) {
      console.log(`[Sidecar] Conversation context: ${conversationContext.totalMessageCount} total messages, summary: ${conversationContext.summary ? 'present' : 'none'}`);
    }
    // Check if Copilot is initialized
    if (!copilotReady || !copilotClient) {
      const initResult = await initializeCopilot();
      if (!initResult.success) {
        sendEvent('error', { message: initResult.error });
        res.end();
        return;
      }
    }
    
    try {
      const workspace = workspaceRoot || process.cwd();
      
      console.log('[Sidecar] Loading system prompts...');
      // Load system prompts (same as non-streaming endpoint)
      let fullSystemPrompt = loadSystemPrompts(mode);
      console.log(`[Sidecar] System prompts loaded: ${fullSystemPrompt.length} chars`);
      
      console.log('[Sidecar] Loading spec and feature files...');
      const specs = loadSpecFiles(workspace);
      const features = loadFeatureFiles(workspace);
      fullSystemPrompt += specs;
      fullSystemPrompt += features;
      console.log(`[Sidecar] Specs and features loaded: ${specs.length + features.length} chars added`);
      // Learnings are now accessed via the search_learnings tool, not bulk-loaded
      
      if (conversationContext?.summary) {
        const summaryPrompt = formatConversationSummary(conversationContext.summary);
        fullSystemPrompt += summaryPrompt;
        console.log(`[Sidecar] Conversation summary added: ${summaryPrompt.length} chars`);
      }
      
      if (conversationContext?.recentMessages && conversationContext.recentMessages.length > 0) {
        const messagesPrompt = formatRecentMessages(conversationContext.recentMessages);
        fullSystemPrompt += messagesPrompt;
        console.log(`[Sidecar] Recent messages added: ${conversationContext.recentMessages.length} messages, ${messagesPrompt.length} chars`);
      }
      
      console.log(`[Sidecar] Full prompt assembled for streaming, total length: ${fullSystemPrompt.length} chars`);
      
      // Create a new session for streaming
      console.log(`[Sidecar] Creating new Copilot session for streaming ${mode} mode`);
      console.log(`[Sidecar] Workspace directory: ${workspace}`);
      console.log(`[Sidecar] Model: gpt-4o`);
      const session = await copilotClient!.createSession({
        model: 'gpt-4o',
        workingDirectory: workspace,
        systemMessage: {
          content: fullSystemPrompt
        },
        tools: [createLearningsTool(workspace)],
        hooks: {
          // Hook to add footer to markdown files after they're written by the AI
          onPostToolUse: async (input) => {
            const toolName = (input.toolName as string | undefined)?.toLowerCase() || '';
            
            if (FILE_WRITE_TOOLS.some(t => toolName.includes(t))) {
              const args = (input.toolArgs as Record<string, any>) || {};
              const filePath = args.path || args.file || args.filename;
              
              if (filePath && typeof filePath === 'string' && filePath.endsWith('.md')) {
                console.log(`[Sidecar] Post-tool hook: Adding footer to ${filePath}`);
                const fullPath = join(workspace, filePath);
                if (existsSync(fullPath)) {
                  try {
                    let content = readFileSync(fullPath, 'utf-8');
                    if (!content.endsWith(FOOTER_MARKER)) {
                      content = addMarkdownFooter(content);
                      writeFileSync(fullPath, content, 'utf-8');
                      console.log(`[Sidecar] Footer added to ${filePath}`);
                    }
                  } catch (error) {
                    console.error(`[Sidecar] Error adding footer to ${filePath}:`, error);
                  }
                }
              }
            }
            return {};
          }
        }
      });
      
      // Buffer for safety - we still collect the full response for file operations
      const responseBuffer: string[] = [];
      
      // Track tool calls for status reporting
      const toolCalls = new Map<string, { toolName: string; toolArgs: any }>();
      
      // Track active command executions
      const activeCommands = new Map<string, { commandId: string; command: string }>();
      
      // Track all unsubscribe functions for cleanup
      const unsubscribeFns: Array<() => void> = [];
      
      // Track if we've already detected and logged AUTO_MODE marker
      let autoModeMarkerDetected = false;
      
      // Helper function to extract command from tool arguments
      const extractCommandFromArgs = (args: Record<string, any>): string | null => {
        // Try common argument names for commands, in order of specificity
        // 'command' is most specific for command execution
        // 'shellCommand' and 'script' are also specific to command execution
        // 'cmd' is common abbreviation for command
        // Note: We intentionally omit 'input' as it's too generic
        return args.command || args.shellCommand || args.script || args.cmd || null;
      };
      
      // Function to clean up all listeners
      const cleanupListeners = () => {
        unsubscribeFns.forEach(fn => fn());
      };
      
      // Set up timeout handling
      let timeoutHandle: NodeJS.Timeout;
      
      const resetTimeout = (reason?: string) => {
        clearTimeout(timeoutHandle);
        if (reason) {
          console.log(`[Sidecar] Activity detected: ${reason} - resetting timeout`);
        }
        // Use longer timeout initially (before any response), shorter timeout once streaming starts
        // This allows Copilot more time to begin responding, but ensures timely cleanup if streaming stalls
        timeoutHandle = setTimeout(() => {
          cleanupListeners();
          session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
          sendEvent('error', { message: 'Response timeout - no activity detected' });
          res.end();
        }, responseBuffer.length > 0 ? ACTIVITY_TIMEOUT_MS : RESPONSE_TIMEOUT_MS);
      };
      
      // Event listeners - stream to client in real-time
      
      // Assistant message - full content chunks
      unsubscribeFns.push(session.on('assistant.message', (event) => {
        if (event.data.content) {
          responseBuffer.push(event.data.content);
          sendEvent('delta', { content: event.data.content });
          
          // For Auto mode, detect and log AUTO_MODE marker
          if (mode === 'Auto' && !autoModeMarkerDetected) {
            const fullResponse = responseBuffer.join('');
            const markerMatch = fullResponse.match(/<!-- AUTO_MODE: (planning|building) -->/);
            if (markerMatch) {
              console.log(`[Sidecar] ========================================`);
              console.log(`[Sidecar] AUTO MODE SELECTION DETECTED: ${markerMatch[1].toUpperCase()}`);
              console.log(`[Sidecar] The AI has chosen ${markerMatch[1]} mode for this request`);
              console.log(`[Sidecar] ========================================`);
              autoModeMarkerDetected = true;
            }
          }
          
          resetTimeout('assistant.message received');
        }
      }));
      
      // Streaming message deltas - partial content as it's generated
      unsubscribeFns.push(session.on('assistant.message_delta', (event) => {
        if (event.data.deltaContent) {
          responseBuffer.push(event.data.deltaContent);
          sendEvent('delta', { content: event.data.deltaContent });
          
          // For Auto mode, detect and log AUTO_MODE marker
          if (mode === 'Auto' && !autoModeMarkerDetected) {
            const fullResponse = responseBuffer.join('');
            const markerMatch = fullResponse.match(/<!-- AUTO_MODE: (planning|building) -->/);
            if (markerMatch) {
              console.log(`[Sidecar] ========================================`);
              console.log(`[Sidecar] AUTO MODE SELECTION DETECTED: ${markerMatch[1].toUpperCase()}`);
              console.log(`[Sidecar] The AI has chosen ${markerMatch[1]} mode for this request`);
              console.log(`[Sidecar] ========================================`);
              autoModeMarkerDetected = true;
            }
          }
          
          // Emit status: streaming response (only once at start)
          if (responseBuffer.length === 1) {
            statusEmitter.emitApiCall('Streaming response...', 'in_progress');
          }
        }
        resetTimeout('streaming content');
      }));
      
      // Assistant turn tracking
      unsubscribeFns.push(session.on('assistant.turn_start', () => {
        sendEvent('turn_start', {});
        resetTimeout('assistant turn started');
      }));
      
      unsubscribeFns.push(session.on('assistant.turn_end', () => {
        sendEvent('turn_end', {});
        resetTimeout('assistant turn ended');
      }));
      
      // Reasoning events
      unsubscribeFns.push(session.on('assistant.reasoning', () => {
        resetTimeout('assistant reasoning');
      }));
      
      unsubscribeFns.push(session.on('assistant.reasoning_delta', () => {
        resetTimeout('streaming reasoning');
      }));
      
      // Tool execution events - notify user about tool usage
      unsubscribeFns.push(session.on('tool.execution_start', (event) => {
        const toolName = event.data.toolName?.toLowerCase() || '';
        const args = event.data.arguments as Record<string, any> || {};
        const filePath = args.path || args.file || args.filename;
        
        console.log(`[Sidecar] Tool execution started: ${event.data.toolName}`);
        console.log(`[Sidecar] Tool call ID: ${event.data.toolCallId}`);
        console.log(`[Sidecar] Tool arguments:`, JSON.stringify(args, null, 2).substring(0, 200));
        
        // Store tool call info for later use
        toolCalls.set(event.data.toolCallId, {
          toolName: event.data.toolName,
          toolArgs: event.data.arguments
        });
        
        // Detect command execution tools (exact match or starts with pattern)
        const isCommandTool = COMMAND_TOOLS.some(t => toolName === t || toolName.startsWith(`${t}_`));
        console.log(`[Sidecar] Tool name check: "${toolName}", isCommandTool: ${isCommandTool}`);
        
        if (isCommandTool) {
          const command = extractCommandFromArgs(args);
          console.log(`[Sidecar] Extracted command from args:`, command);
          
          if (command) {
            const commandId = `cmd-${event.data.toolCallId}`;
            console.log(`[Sidecar] Command execution detected: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
            console.log(`[Sidecar] Command ID: ${commandId}, Tool call ID: ${event.data.toolCallId}`);
            
            // Track this as an active command
            activeCommands.set(event.data.toolCallId, { commandId, command });
            console.log(`[Sidecar] Active commands tracked: ${activeCommands.size}`);
            
            // Emit command_start event
            sendEvent('command_start', {
              commandId,
              command,
              toolCallId: event.data.toolCallId
            });
          } else {
            console.log(`[Sidecar] Command tool detected but no command extracted from args`);
          }
        }
        
        // Emit status for file operations (with relative paths)
        if (FILE_WRITE_TOOLS.some(t => toolName.includes(t)) && filePath) {
          const relativePath = toRelativePath(workspace, filePath);
          console.log(`[Sidecar] File write operation: ${relativePath}`);
          statusEmitter.emitFileWrite(relativePath, 'in_progress');
        } else if (toolName.includes('view') || toolName.includes('read')) {
          if (filePath) {
            const relativePath = toRelativePath(workspace, filePath);
            statusEmitter.emitFileRead(relativePath, 'in_progress');
          }
        } else if (toolName.includes('grep') || toolName.includes('glob')) {
          statusEmitter.emitAnalysis('Searching code...', 'in_progress');
        }
        
        console.log(`[Sidecar] Tool started: ${event.data.toolName}`);
        sendEvent('tool_start', { toolName: event.data.toolName });
        resetTimeout(`tool started: ${event.data.toolName}`);
      }));
      
      unsubscribeFns.push(session.on('tool.execution_progress', (event) => {
        console.log(`[Sidecar] Tool progress - toolCallId: ${event.data.toolCallId}, message: ${event.data.progressMessage}`);
        
        // Check if this is an active command execution
        const activeCmd = activeCommands.get(event.data.toolCallId);
        console.log(`[Sidecar] Active command lookup for ${event.data.toolCallId}:`, activeCmd ? `Found: ${activeCmd.command}` : 'Not found');
        console.log(`[Sidecar] Active commands map size: ${activeCommands.size}, keys:`, Array.from(activeCommands.keys()));
        
        if (activeCmd && event.data.progressMessage) {
          console.log(`[Sidecar] Emitting command_output for ${activeCmd.commandId}`);
          // Emit command output event
          sendEvent('command_output', {
            commandId: activeCmd.commandId,
            output: event.data.progressMessage
          });
        }
        
        sendEvent('tool_progress', { message: event.data.progressMessage });
        resetTimeout(`tool progress: ${event.data.progressMessage}`);
      }));
      
      unsubscribeFns.push(session.on('tool.execution_partial_result', (event) => {
        console.log(`[Sidecar] Tool partial result - toolCallId: ${event.data.toolCallId}, output length: ${event.data.partialOutput?.length || 0}`);
        
        // Check if this is an active command execution
        const activeCmd = activeCommands.get(event.data.toolCallId);
        if (activeCmd && event.data.partialOutput) {
          console.log(`[Sidecar] Emitting command_output from partial_result for ${activeCmd.commandId}`);
          // Emit command output event
          sendEvent('command_output', {
            commandId: activeCmd.commandId,
            output: event.data.partialOutput
          });
        }
        
        resetTimeout('tool partial result');
      }));
      
      unsubscribeFns.push(session.on('tool.execution_complete', (event) => {
        console.log(`[Sidecar] Tool execution completed`);
        console.log(`[Sidecar] Tool call ID: ${event.data.toolCallId}`);
        console.log(`[Sidecar] Success: ${event.data.success}`);
        
        // Check if this was a command execution
        const activeCmd = activeCommands.get(event.data.toolCallId);
        if (activeCmd) {
          console.log(`[Sidecar] Command completed: ${activeCmd.command.substring(0, 100)}${activeCmd.command.length > 100 ? '...' : ''}`);
          console.log(`[Sidecar] Exit code: ${event.data.success ? 0 : 1}`);
          
          // Emit command_complete event
          sendEvent('command_complete', {
            commandId: activeCmd.commandId,
            exitCode: event.data.success ? 0 : 1,
            success: event.data.success !== false
          });
          
          // Clean up command tracking
          activeCommands.delete(event.data.toolCallId);
        }
        
        // Get stored tool call info
        const toolCallInfo = toolCalls.get(event.data.toolCallId);
        if (toolCallInfo) {
          const toolName = toolCallInfo.toolName?.toLowerCase() || '';
          const args = ((toolCallInfo.toolArgs as Record<string, any> | undefined) || {});
          const filePath = args.path || args.file || args.filename;
          
          console.log(`[Sidecar] Tool "${toolName}" completed, file path: ${filePath || 'none'}`);
          
          // Emit completion status for file operations (with relative paths)
          if (event.data.success) {
            if (FILE_WRITE_TOOLS.some(t => toolName.includes(t)) && filePath) {
              const relativePath = toRelativePath(workspace, filePath);
              console.log(`[Sidecar] File write successful: ${relativePath}`);
              statusEmitter.emitFileWrite(relativePath, 'complete');
            } else if ((toolName.includes('view') || toolName.includes('read')) && filePath) {
              const relativePath = toRelativePath(workspace, filePath);
              console.log(`[Sidecar] File read successful: ${relativePath}`);
              statusEmitter.emitFileRead(relativePath, 'complete');
            } else if (toolName.includes('grep') || toolName.includes('glob')) {
              console.log(`[Sidecar] Search completed successfully`);
              statusEmitter.emitAnalysis('Search complete', 'complete');
            }
          } else {
            console.log(`[Sidecar] Tool execution failed`);
            // Emit error status if tool failed (with relative paths)
            if (FILE_WRITE_TOOLS.some(t => toolName.includes(t)) && filePath) {
              const relativePath = toRelativePath(workspace, filePath);
              console.log(`[Sidecar] File write failed: ${relativePath}`);
              statusEmitter.emitFileWrite(`Failed to write ${relativePath}`, 'error');
            } else if ((toolName.includes('view') || toolName.includes('read')) && filePath) {
              const relativePath = toRelativePath(workspace, filePath);
              console.log(`[Sidecar] File read failed: ${relativePath}`);
              statusEmitter.emitFileRead(`Failed to read ${relativePath}`, 'error');
            }
          }
          
          // Clean up stored tool call
          toolCalls.delete(event.data.toolCallId);
        }
        
        sendEvent('tool_complete', { 
          toolCallId: event.data.toolCallId,
          success: event.data.success 
        });
        resetTimeout('tool completed');
      }));
      
      // Subagent events
      unsubscribeFns.push(session.on('subagent.started', (event) => {
        console.log(`[Sidecar] Subagent started: ${event.data.agentDisplayName}`);
        sendEvent('subagent_start', { agentName: event.data.agentDisplayName });
        resetTimeout(`subagent started: ${event.data.agentDisplayName}`);
      }));
      
      unsubscribeFns.push(session.on('subagent.completed', () => {
        console.log('[Sidecar] Subagent completed');
        sendEvent('subagent_complete', {});
        resetTimeout('subagent completed');
      }));
      
      // Session becomes idle - completion signal
      unsubscribeFns.push(session.on('session.idle', () => {
        console.log('[Sidecar] ========================================');
        console.log('[Sidecar] Session idle - streaming complete');
        console.log(`[Sidecar] Total response length: ${responseBuffer.join('').length} chars`);
        
        // Warn if Auto mode didn't produce a marker
        if (mode === 'Auto' && !autoModeMarkerDetected) {
          console.warn('[Sidecar] WARNING: Auto mode response completed but no AUTO_MODE marker was detected');
          console.warn('[Sidecar] This may indicate the AI did not follow the auto mode system prompt');
        }
        
        console.log('[Sidecar] ========================================');
        clearTimeout(timeoutHandle);
        cleanupListeners();
        
        // Emit status: response complete
        statusEmitter.emitApiCall('Response complete', 'complete');
        
        // Emit session complete to trigger auto-hide in frontend
        statusEmitter.emitSessionComplete();
        
        // Send the complete buffered response for any post-processing
        sendEvent('done', { fullResponse: responseBuffer.join('') });
        res.end();
        
        // Destroy session after use
        session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
      }));
      
      // Session error
      unsubscribeFns.push(session.on('session.error', (event) => {
        console.error('[Sidecar] ========================================');
        console.error('[Sidecar] SESSION ERROR:', event.data.message);
        console.error('[Sidecar] ========================================');
        clearTimeout(timeoutHandle);
        cleanupListeners();
        
        sendEvent('error', { message: event.data.message || 'Copilot session error' });
        res.end();
        
        // Destroy session after error
        session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
      }));
      
      // Handle client disconnect
      req.on('close', () => {
        console.log('[Sidecar] Client disconnected from stream');
        clearTimeout(timeoutHandle);
        cleanupListeners();
        session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
      });
      
      // Set initial timeout
      resetTimeout();
      
      // Emit status: requesting Copilot response
      statusEmitter.emitApiCall('Requesting Copilot response...', 'in_progress');
      
      // Send the message to start streaming
      console.log('[Sidecar] Sending message to Copilot session...');
      await session.send({ prompt: message });
      console.log('[Sidecar] Message sent to Copilot, waiting for response...');
      
    } catch (error: unknown) {
      console.error('[Sidecar] ========================================');
      console.error('[Sidecar] ERROR IN STREAMING:');
      console.error('[Sidecar]', error);
      console.error('[Sidecar] ========================================');
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendEvent('error', { message: `Failed to communicate with Copilot: ${errorMessage}` });
      res.end();
    }
    return;
  }
  
  // Unknown mode
  console.error(`[Sidecar] Unknown mode requested: ${mode}`);
  sendEvent('error', { message: `Unknown mode: ${mode}` });
  res.end();
});

// Main chat endpoint
app.post('/api/copilot/chat', async (req, res) => {
  const { mode, message, workspaceRoot, contextFiles, conversationContext } = req.body;
  
  console.log('[Sidecar] ========================================');
  console.log(`[Sidecar] Non-streaming chat request received`);
  console.log(`[Sidecar] Mode: ${mode}`);
  console.log(`[Sidecar] Message: ${message?.substring(0, 100)}${message && message.length > 100 ? '...' : ''}`);
  console.log(`[Sidecar] Workspace: ${workspaceRoot || 'not specified'}`);
  if (conversationContext) {
    console.log(`[Sidecar] Conversation context: ${conversationContext.totalMessageCount} total messages, summary: ${conversationContext.summary ? 'present' : 'none'}`);
  }
  console.log('[Sidecar] ========================================');
  
  // For Analyzing mode, return stub response (not ready yet)
  if (mode === 'Analyzing') {
    console.log('[Sidecar] Analyzing mode - returning stub response');
    return res.json({
      replyText: 'Analyzing coming soon',
      actions: []
    });
  }
  
  // For Auto, Planning and Building modes, use Copilot SDK
  if (mode === 'Auto' || mode === 'Planning' || mode === 'Building') {
    console.log(`[Sidecar] Processing ${mode} mode request...`);
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
      // =========================================================================
      // PROMPT ASSEMBLY ORDER (as per conversation-memory.feature.md)
      // 1) Base system prompt
      // 2) Mode system prompt
      // 3) Spec + feature files
      // 4) Conversation summary
      // 5) Recent messages
      // 6) Current user message (sent separately)
      // Note: Learnings are now accessed via the search_learnings tool
      // =========================================================================
      
      const workspace = workspaceRoot || process.cwd();
      
      console.log('[Sidecar] Loading system prompts...');
      // 1-2) Load system prompts from naide app repository (base + mode)
      let fullSystemPrompt = loadSystemPrompts(mode);
      console.log(`[Sidecar] System prompts loaded: ${fullSystemPrompt.length} chars`);
      
      console.log('[Sidecar] Loading spec and feature files...');
      // 3) Load spec and feature files from user's project
      const specs = loadSpecFiles(workspace);
      const features = loadFeatureFiles(workspace);
      fullSystemPrompt += specs;
      fullSystemPrompt += features;
      console.log(`[Sidecar] Specs and features loaded: ${specs.length + features.length} chars added`);
      
      // 5) Add conversation summary (mid-term memory)
      if (conversationContext?.summary) {
        const summaryPrompt = formatConversationSummary(conversationContext.summary);
        fullSystemPrompt += summaryPrompt;
        console.log(`[Sidecar] Conversation summary added: ${summaryPrompt.length} chars`);
      }
      
      // 6) Add recent messages (short-term memory)
      if (conversationContext?.recentMessages && conversationContext.recentMessages.length > 0) {
        const messagesPrompt = formatRecentMessages(conversationContext.recentMessages);
        fullSystemPrompt += messagesPrompt;
        console.log(`[Sidecar] Recent messages added: ${conversationContext.recentMessages.length} messages, ${messagesPrompt.length} chars`);
      }
      
      console.log(`[Sidecar] Full prompt assembled, total length: ${fullSystemPrompt.length} chars`);
      
      // Create a new session for each request to avoid conflicts
      console.log(`[Sidecar] Creating new Copilot session for ${mode} mode`);
      console.log(`[Sidecar] Workspace directory: ${workspace}`);
      console.log(`[Sidecar] Model: gpt-4o`);
      const session = await copilotClient!.createSession({
        model: 'gpt-4o',
        workingDirectory: workspace,
        systemMessage: {
          content: fullSystemPrompt
        },
        tools: [createLearningsTool(workspace)],
        hooks: {
          // Hook to add footer to markdown files after they're written by the AI
          onPostToolUse: async (input) => {
            // Check if this was a file write operation
            const toolName = (input.toolName as string | undefined)?.toLowerCase() || '';
            
            if (FILE_WRITE_TOOLS.some(t => toolName.includes(t))) {
              // Check if a file path was provided and it's a markdown file
              const args = (input.toolArgs as Record<string, any>) || {};
              const filePath = args.path || args.file || args.filename;
              
              if (filePath && typeof filePath === 'string' && filePath.endsWith('.md')) {
                console.log(`[Sidecar] Post-tool hook: Adding footer to ${filePath}`);
                
                // Read the file that was just written
                const fullPath = join(workspace, filePath);
                if (existsSync(fullPath)) {
                  try {
                    let content = readFileSync(fullPath, 'utf-8');
                    
                    // Add footer if not already present
                    if (!content.endsWith(FOOTER_MARKER)) {
                      content = addMarkdownFooter(content);
                      writeFileSync(fullPath, content, 'utf-8');
                      console.log(`[Sidecar] Footer added to ${filePath}`);
                    } else {
                      console.log(`[Sidecar] Footer already present in ${filePath}`);
                    }
                  } catch (error) {
                    console.error(`[Sidecar] Error adding footer to ${filePath}:`, error);
                  }
                }
              }
            }
            
            return {};
          }
        }
      });
      
      // 7) Send current user message and collect response
      const responseChunks: string[] = [];
      
      // Track tool calls for status reporting
      const toolCalls = new Map<string, { toolName: string; toolArgs: any }>();
      
      // Track if we've already detected and logged AUTO_MODE marker
      let autoModeMarkerDetected = false;
      
      // Set up event listeners for the response BEFORE sending
      const responsePromise = new Promise<string>((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout;
        const RESPONSE_TIMEOUT_MS = 180000; // 3 minute base timeout
        const ACTIVITY_TIMEOUT_MS = 120000; // 2 minute inactivity timeout (reset on any activity)
        
        // Track all unsubscribe functions for cleanup
        const unsubscribeFns: Array<() => void> = [];
        
        // Function to clean up all listeners
        const cleanupListeners = () => {
          unsubscribeFns.forEach(fn => fn());
        };
        
        // Function to reset timeout on activity
        const resetTimeout = (reason?: string) => {
          clearTimeout(timeoutHandle);
          if (reason) {
            console.log(`[Sidecar] Activity detected: ${reason} - resetting timeout`);
          }
          timeoutHandle = setTimeout(() => {
            // Clean up listeners on timeout
            cleanupListeners();
            
            // Destroy session after timeout
            session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
            
            reject(new Error('Response timeout - no activity for 2 minutes'));
          }, responseChunks.length > 0 ? ACTIVITY_TIMEOUT_MS : RESPONSE_TIMEOUT_MS);
        };
        
        // =========================================================================
        // Event listeners for all activity types
        // The SDK emits various events during processing - we listen to all of them
        // to properly detect activity and prevent premature timeouts
        // =========================================================================
        
        // Assistant message - the final response content
        unsubscribeFns.push(session.on('assistant.message', (event) => {
          if (event.data.content) {
            responseChunks.push(event.data.content);
            
            // For Auto mode, detect and log AUTO_MODE marker
            if (mode === 'Auto' && !autoModeMarkerDetected) {
              const fullResponse = responseChunks.join('');
              const markerMatch = fullResponse.match(/<!-- AUTO_MODE: (planning|building) -->/);
              if (markerMatch) {
                console.log(`[Sidecar] ========================================`);
                console.log(`[Sidecar] AUTO MODE SELECTION DETECTED: ${markerMatch[1].toUpperCase()}`);
                console.log(`[Sidecar] The AI has chosen ${markerMatch[1]} mode for this request`);
                console.log(`[Sidecar] ========================================`);
                autoModeMarkerDetected = true;
              }
            }
            
            resetTimeout('assistant.message received');
          }
        }));
        
        // Streaming message deltas - partial content as it's generated
        unsubscribeFns.push(session.on('assistant.message_delta', (event) => {
          resetTimeout('streaming content');
        }));
        
        // Assistant turn tracking
        unsubscribeFns.push(session.on('assistant.turn_start', () => {
          resetTimeout('assistant turn started');
        }));
        
        unsubscribeFns.push(session.on('assistant.turn_end', () => {
          resetTimeout('assistant turn ended');
        }));
        
        // Reasoning events (for models that support it)
        unsubscribeFns.push(session.on('assistant.reasoning', () => {
          resetTimeout('assistant reasoning');
        }));
        
        unsubscribeFns.push(session.on('assistant.reasoning_delta', () => {
          resetTimeout('streaming reasoning');
        }));
        
        // Tool execution events - CRITICAL for long-running tool calls
        unsubscribeFns.push(session.on('tool.execution_start', (event) => {
          const toolName = event.data.toolName?.toLowerCase() || '';
          const args = event.data.arguments as Record<string, any> || {};
          const filePath = args.path || args.file || args.filename;
          
          // Store tool call info for later use
          toolCalls.set(event.data.toolCallId, {
            toolName: event.data.toolName,
            toolArgs: event.data.arguments
          });
          
          // Emit status for file operations (with relative paths)
          if (FILE_WRITE_TOOLS.some(t => toolName.includes(t)) && filePath) {
            const relativePath = toRelativePath(workspace, filePath);
            statusEmitter.emitFileWrite(relativePath, 'in_progress');
          } else if (toolName.includes('view') || toolName.includes('read')) {
            if (filePath) {
              const relativePath = toRelativePath(workspace, filePath);
              statusEmitter.emitFileRead(relativePath, 'in_progress');
            }
          } else if (toolName.includes('grep') || toolName.includes('glob')) {
            statusEmitter.emitAnalysis('Searching code...', 'in_progress');
          }
          
          console.log(`[Sidecar] Tool started: ${event.data.toolName}`);
          resetTimeout(`tool started: ${event.data.toolName}`);
        }));
        
        unsubscribeFns.push(session.on('tool.execution_progress', (event) => {
          console.log(`[Sidecar] Tool progress: ${event.data.progressMessage}`);
          resetTimeout(`tool progress: ${event.data.progressMessage}`);
        }));
        
        unsubscribeFns.push(session.on('tool.execution_partial_result', () => {
          resetTimeout('tool partial result');
        }));
        
        unsubscribeFns.push(session.on('tool.execution_complete', (event) => {
          console.log(`[Sidecar] Tool completed: ${event.data.toolCallId}, success: ${event.data.success}`);
          
          // Get stored tool call info
          const toolCallInfo = toolCalls.get(event.data.toolCallId);
          if (toolCallInfo) {
            const toolName = toolCallInfo.toolName?.toLowerCase() || '';
            const args = ((toolCallInfo.toolArgs as Record<string, any> | undefined) || {});
            const filePath = args.path || args.file || args.filename;
            
            // Emit completion status for file operations (with relative paths)
            if (event.data.success) {
              if (FILE_WRITE_TOOLS.some(t => toolName.includes(t)) && filePath) {
                const relativePath = toRelativePath(workspace, filePath);
                statusEmitter.emitFileWrite(relativePath, 'complete');
              } else if ((toolName.includes('view') || toolName.includes('read')) && filePath) {
                const relativePath = toRelativePath(workspace, filePath);
                statusEmitter.emitFileRead(relativePath, 'complete');
              } else if (toolName.includes('grep') || toolName.includes('glob')) {
                statusEmitter.emitAnalysis('Search complete', 'complete');
              }
            } else {
              // Emit error status if tool failed (with relative paths)
              if (FILE_WRITE_TOOLS.some(t => toolName.includes(t)) && filePath) {
                const relativePath = toRelativePath(workspace, filePath);
                statusEmitter.emitFileWrite(`Failed to write ${relativePath}`, 'error');
              } else if ((toolName.includes('view') || toolName.includes('read')) && filePath) {
                const relativePath = toRelativePath(workspace, filePath);
                statusEmitter.emitFileRead(`Failed to read ${relativePath}`, 'error');
              }
            }
            
            // Clean up stored tool call
            toolCalls.delete(event.data.toolCallId);
          }
          
          resetTimeout('tool completed');
        }));
        
        // Subagent events (for complex multi-agent workflows)
        unsubscribeFns.push(session.on('subagent.started', (event) => {
          console.log(`[Sidecar] Subagent started: ${event.data.agentDisplayName}`);
          resetTimeout(`subagent started: ${event.data.agentDisplayName}`);
        }));
        
        unsubscribeFns.push(session.on('subagent.completed', () => {
          resetTimeout('subagent completed');
        }));
        
        // Session becomes idle - this is our completion signal
        unsubscribeFns.push(session.on('session.idle', () => {
          console.log('[Sidecar] ========================================');
          console.log('[Sidecar] Session idle - request complete');
          console.log(`[Sidecar] Total response length: ${responseChunks.join('').length} chars`);
          
          // Warn if Auto mode didn't produce a marker
          if (mode === 'Auto' && !autoModeMarkerDetected) {
            console.warn('[Sidecar] WARNING: Auto mode response completed but no AUTO_MODE marker was detected');
            console.warn('[Sidecar] This may indicate the AI did not follow the auto mode system prompt');
          }
          
          console.log('[Sidecar] ========================================');
          clearTimeout(timeoutHandle);
          cleanupListeners();
          
          // Emit session complete to trigger auto-hide in frontend
          statusEmitter.emitSessionComplete();
          
          // Destroy session after use
          session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
          
          resolve(responseChunks.join(''));
        }));
        
        // Session error
        unsubscribeFns.push(session.on('session.error', (event) => {
          console.error('[Sidecar] ========================================');
          console.error('[Sidecar] SESSION ERROR:', event.data.message);
          console.error('[Sidecar] ========================================');
          clearTimeout(timeoutHandle);
          cleanupListeners();
          
          // Destroy session after error
          session.destroy().catch(err => console.error('[Sidecar] Error destroying session:', err));
          
          reject(new Error(event.data.message || 'Copilot session error'));
        }));
        
        // Set initial timeout
        resetTimeout();
      });
      
      // Send the message AFTER setting up listeners
      console.log('[Sidecar] Sending message to Copilot session...');
      await session.send({ prompt: message });
      console.log('[Sidecar] Message sent, waiting for response...');
      
      // Wait for the response
      const replyText = await responsePromise;
      console.log('[Sidecar] Response received');
      
      const response = {
        replyText: replyText || 'No response from Copilot',
        actions: []
      };
      
      return res.json(response);
    } catch (error: unknown) {
      console.error('[Sidecar] ========================================');
      console.error('[Sidecar] ERROR CALLING COPILOT:');
      console.error('[Sidecar]', error);
      console.error('[Sidecar] ========================================');
      const errorMessage = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        error: 'Failed to communicate with Copilot',
        replyText: `An error occurred while communicating with Copilot: ${errorMessage}`
      });
    }
  }
  
  // Unknown mode
  console.error(`[Sidecar] Unknown mode requested: ${mode}`);
  return res.status(400).json({
    error: `Unknown mode: ${mode}`,
    replyText: `Unknown mode: ${mode}`
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', copilotReady });
});

// =============================================================================
// Proxy API endpoints - for proxying the running app with script injection
// =============================================================================

// Start proxy for a target URL
app.post('/api/proxy/start', async (req, res) => {
  const { targetUrl } = req.body;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'targetUrl is required' });
  }
  
  console.log(`[Sidecar] Starting proxy for: ${targetUrl}`);
  
  try {
    const proxyUrl = await proxyServer.start(targetUrl);
    console.log(`[Sidecar] Proxy started: ${proxyUrl} -> ${targetUrl}`);
    return res.json({ proxyUrl, targetUrl });
  } catch (error) {
    console.error('[Sidecar] Failed to start proxy:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to start proxy: ${errorMessage}` });
  }
});

// Stop the proxy
app.post('/api/proxy/stop', async (req, res) => {
  console.log('[Sidecar] Stopping proxy');
  
  try {
    await proxyServer.stop();
    console.log('[Sidecar] Proxy stopped');
    return res.json({ success: true });
  } catch (error) {
    console.error('[Sidecar] Failed to stop proxy:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to stop proxy: ${errorMessage}` });
  }
});

// Get proxy status
app.get('/api/proxy/status', (req, res) => {
  return res.json({
    running: proxyServer.isRunning(),
    targetUrl: proxyServer.getTargetUrl()
  });
});

// Start the server and initialize Copilot
const server = createServer(app);

// Create WebSocket server for status events
createStatusWebSocketServer(server, statusEmitter);

server.listen(PORT, async () => {
  console.log(`[Sidecar] Copilot sidecar running on http://localhost:${PORT}`);
  console.log(`[Sidecar] WebSocket server ready at ws://localhost:${PORT}/api/status`);
  
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
    // Stop proxy if running
    if (proxyServer.isRunning()) {
      await proxyServer.stop();
    }
    
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
