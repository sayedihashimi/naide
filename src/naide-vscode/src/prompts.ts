/**
 * System prompt and specification file loading for Naide
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getSystemPromptFiles, NaideMode } from './modes';

/**
 * Loads system prompts from the extension's bundled .prompts/system directory
 * @param extensionContext - The extension context
 * @param mode - The Naide mode
 * @returns The assembled system prompt content
 */
export async function loadSystemPrompts(
  extensionContext: vscode.ExtensionContext,
  mode: NaideMode
): Promise<string> {
  // System prompts are bundled with the extension, not in the workspace
  const promptsDir = vscode.Uri.joinPath(extensionContext.extensionUri, '.prompts', 'system');
  
  const files = getSystemPromptFiles(mode);
  let systemPrompt = '';
  
  for (const file of files) {
    const filePath = vscode.Uri.joinPath(promptsDir, file);
    try {
      const content = await vscode.workspace.fs.readFile(filePath);
      const text = new TextDecoder('utf-8').decode(content);
      systemPrompt += text + '\n\n';
      console.log(`[Naide] Loaded system prompt: ${file}`);
    } catch {
      console.warn(`[Naide] System prompt not found: ${file}`);
    }
  }
  
  // Add conversation memory instructions (matching sidecar implementation)
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

  // Add learnings tool instructions (matching sidecar implementation)
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
}

/**
 * Loads specification files from .prompts/plan/
 * @param workspaceRoot - The workspace root URI
 * @returns The assembled spec content
 */
export async function loadSpecFiles(workspaceRoot: vscode.Uri): Promise<string> {
  const config = vscode.workspace.getConfiguration('naide');
  const specsPath = config.get<string>('specsPath', '.prompts/plan');
  const planDir = vscode.Uri.joinPath(workspaceRoot, specsPath);
  
  const specFiles = ['intent.md', 'app-spec.md', 'data-spec.md', 'rules.md', 'tasks.json'];
  let specs = '';
  let hasContent = false;
  
  for (const file of specFiles) {
    const filePath = vscode.Uri.joinPath(planDir, file);
    try {
      const content = await vscode.workspace.fs.readFile(filePath);
      const text = new TextDecoder('utf-8').decode(content);
      specs += `### ${file}\n\`\`\`\n${text}\n\`\`\`\n\n`;
      hasContent = true;
    } catch {
      // File doesn't exist, skip it
    }
  }
  
  if (!hasContent) {
    return '';
  }
  
  return `\n\n# PROJECT SPECIFICATIONS\n\n${specs}`;
}

/**
 * Loads feature files from .prompts/features/
 * @param workspaceRoot - The workspace root URI
 * @returns The assembled features content
 */
export async function loadFeatureFiles(workspaceRoot: vscode.Uri): Promise<string> {
  const config = vscode.workspace.getConfiguration('naide');
  const featuresPath = config.get<string>('featuresPath', '.prompts/features');
  const maxFeaturesCharacters = config.get<number>('maxFeaturesCharacters', 50000);
  const featuresDir = vscode.Uri.joinPath(workspaceRoot, featuresPath);
  
  try {
    const files = await readDirectoryRecursive(featuresDir);
    
    // Filter out removed-features and bugs directories
    const featureFiles = files.filter(
      (file) =>
        file.endsWith('.md') &&
        !file.includes('removed-features') &&
        !file.includes('bugs')
    );
    
    if (featureFiles.length === 0) {
      return '';
    }
    
    let features = '';
    let hasContent = false;
    let skippedCount = 0;
    
    for (const file of featureFiles) {
      const filePath = vscode.Uri.file(file);
      try {
        const content = await vscode.workspace.fs.readFile(filePath);
        const text = new TextDecoder('utf-8').decode(content);
        // Get relative path for display
        const relativePath = path.relative(featuresDir.fsPath, file);
        const entry = `### ${relativePath}\n\`\`\`\n${text}\n\`\`\`\n\n`;
        
        if (features.length + entry.length > maxFeaturesCharacters) {
          skippedCount++;
          continue;
        }
        
        features += entry;
        hasContent = true;
      } catch {
        // Skip files that can't be read
      }
    }
    
    if (!hasContent) {
      return '';
    }
    
    let result = `\n\n# FEATURE SPECIFICATIONS\n\n${features}`;
    if (skippedCount > 0) {
      result += `\n\n> **Note**: ${skippedCount} feature file(s) were omitted to stay within the context limit. Increase \`naide.maxFeaturesCharacters\` in VS Code settings to include more features.\n`;
    }
    return result;
  } catch {
    // Features directory doesn't exist
    return '';
  }
}

/**
 * Recursively reads all files in a directory
 * @param dir - The directory URI to read
 * @returns Array of full file paths
 */
async function readDirectoryRecursive(dir: vscode.Uri): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    
    for (const [name, type] of entries) {
      const fullPath = vscode.Uri.joinPath(dir, name);
      
      if (type === vscode.FileType.Directory) {
        // Recursively read subdirectory
        const subFiles = await readDirectoryRecursive(fullPath);
        files.push(...subFiles);
      } else if (type === vscode.FileType.File) {
        files.push(fullPath.fsPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}
