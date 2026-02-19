/**
 * Search learnings tool registration for Naide
 */

import * as vscode from 'vscode';
import { logInfo, logError } from './logger';

/**
 * Registers the search_learnings language model tool
 * @param context - The extension context
 */
export function registerLearningsTool(context: vscode.ExtensionContext): void {
  const tool = vscode.lm.registerTool('naide_searchLearnings', {
    invoke: async (options) => {
      try {
        const params = options.input as { keywords: string[] };
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

        if (!workspaceRoot) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('No workspace open.')
          ]);
        }

        const result = await searchLearnings(workspaceRoot, params.keywords);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(result)
        ]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('[Naide] Error in search_learnings tool:', errorMessage);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error searching learnings: ${errorMessage}`)
        ]);
      }
    }
  });

  context.subscriptions.push(tool);
  logInfo('[Naide] Registered search_learnings tool');
}

/**
 * Searches learnings directory for relevant content based on keywords
 * @param workspaceRoot - The workspace root URI
 * @param keywords - Keywords to search for
 * @returns Formatted search results
 */
async function searchLearnings(
  workspaceRoot: vscode.Uri,
  keywords: string[]
): Promise<string> {
  const config = vscode.workspace.getConfiguration('naide');
  const learningsPath = config.get<string>('learningsPath', '.prompts/learnings');
  const learningsDir = vscode.Uri.joinPath(workspaceRoot, learningsPath);

  // Check if learnings directory exists
  try {
    await vscode.workspace.fs.stat(learningsDir);
  } catch {
    return 'No learnings directory found. This is a new project with no recorded learnings yet.';
  }

  try {
    const entries = await vscode.workspace.fs.readDirectory(learningsDir);
    const files = entries
      .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
      .map(([name]) => name);

    if (files.length === 0) {
      return 'No learnings found. This is a new project with no recorded learnings yet.';
    }

    // Normalize keywords for matching
    const normalizedKeywords = keywords
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length > 0);

    if (normalizedKeywords.length === 0) {
      // No keywords provided - return list of available learning files
      return `Available learning files (use specific keywords to search):\n${files.map((f) => `- ${f}`).join('\n')}`;
    }

    // Search through learnings and score by relevance
    const matches: Array<{ file: string; content: string; score: number }> = [];

    for (const file of files) {
      const filePath = vscode.Uri.joinPath(learningsDir, file);
      const content = await vscode.workspace.fs.readFile(filePath);
      const text = new TextDecoder('utf-8').decode(content);
      const lowerContent = text.toLowerCase();
      const lowerFile = file.toLowerCase();

      // Score based on keyword matches
      let score = 0;
      for (const keyword of normalizedKeywords) {
        // Check filename (higher weight)
        if (lowerFile.includes(keyword)) {
          score += 3;
        }
        // Check content (count occurrences)
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const occurrences = (lowerContent.match(new RegExp(escapedKeyword, 'g')) || []).length;
        score += occurrences;
      }

      if (score > 0) {
        matches.push({ file, content: text, score });
      }
    }

    if (matches.length === 0) {
      return `No learnings found matching keywords: ${keywords.join(', ')}\n\nAvailable learning files:\n${files.map((f) => `- ${f}`).join('\n')}`;
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
    logError('[Naide] Error searching learnings:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error searching learnings: ${errorMessage}`;
  }
}
