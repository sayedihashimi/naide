/**
 * Search features tool registration for Naide
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { logInfo, logError, logWarn } from './logger';

/** Maximum number of feature file matches to return from a search. */
const MAX_FEATURE_RESULTS = 5;

/**
 * Registers the naide_searchFeatures language model tool
 * @param context - The extension context
 */
export function registerFeaturesTool(context: vscode.ExtensionContext): void {
  logInfo('[Naide] Registering naide_searchFeatures language model tool...');
  const tool = vscode.lm.registerTool('naide_searchFeatures', {
    invoke: async (options) => {
      logInfo('[Naide] naide_searchFeatures invoke() called');
      logInfo(`[Naide]   raw input: ${JSON.stringify(options.input)}`);
      try {
        const params = options.input as { keywords: string[] };
        const keywords = Array.isArray(params?.keywords) ? params.keywords : [];
        logInfo(`[Naide]   keywords: ${JSON.stringify(keywords)}`);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

        if (!workspaceRoot) {
          logWarn('[Naide]   no workspace open, returning early');
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('No workspace open.')
          ]);
        }

        logInfo(`[Naide]   workspace root: ${workspaceRoot.fsPath}`);
        const result = await searchFeatures(workspaceRoot, keywords);
        logInfo(`[Naide]   search result length: ${result.length} chars`);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(result)
        ]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('[Naide] Error in naide_searchFeatures tool:', errorMessage);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error searching features: ${errorMessage}`)
        ]);
      }
    }
  });

  context.subscriptions.push(tool);
  logInfo('[Naide] Registered naide_searchFeatures tool successfully');
}

/**
 * Searches features directory for relevant content based on keywords
 * @param workspaceRoot - The workspace root URI
 * @param keywords - Keywords to search for
 * @returns Formatted search results
 */
export async function searchFeatures(
  workspaceRoot: vscode.Uri,
  keywords: string[]
): Promise<string> {
  const config = vscode.workspace.getConfiguration('naide');
  const featuresPath = config.get<string>('featuresPath', '.prompts/features');
  const featuresDir = vscode.Uri.joinPath(workspaceRoot, featuresPath);

  logInfo(`[Naide]   searchFeatures: path="${featuresPath}", dir="${featuresDir.fsPath}"`);

  // Check if features directory exists
  try {
    await vscode.workspace.fs.stat(featuresDir);
    logInfo(`[Naide]   searchFeatures: directory exists`);
  } catch {
    logWarn(`[Naide]   searchFeatures: directory not found at ${featuresDir.fsPath}`);
    return 'No features directory found. This is a new project with no feature specifications yet.';
  }

  try {
    const allFiles = await readFeaturesDirectoryRecursive(featuresDir);

    // Filter to .md files, exclude removed-features and bugs subdirectories
    const featureFiles = allFiles.filter(
      (filePath) =>
        filePath.endsWith('.md') &&
        !filePath.includes('removed-features') &&
        !filePath.includes('bugs')
    );

    logInfo(`[Naide]   searchFeatures: found ${allFiles.length} total files, ${featureFiles.length} feature .md files`);

    if (featureFiles.length === 0) {
      return 'No feature files found. This is a new project with no feature specifications yet.';
    }

    // Normalize keywords for matching
    const normalizedKeywords = keywords
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length > 0);

    if (normalizedKeywords.length === 0) {
      // No keywords provided - return list of available feature files
      const fileNames = featureFiles.map((f) => `- ${path.basename(f)}`).join('\n');
      return `Available feature files (use specific keywords to search):\n${fileNames}`;
    }

    // Search through features and score by relevance
    const matches: Array<{ file: string; content: string; score: number }> = [];

    for (const filePath of featureFiles) {
      const fileUri = vscode.Uri.file(filePath);
      try {
        const content = await vscode.workspace.fs.readFile(fileUri);
        const text = new TextDecoder('utf-8').decode(content);
        const lowerContent = text.toLowerCase();
        const lowerFile = path.basename(filePath).toLowerCase();

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
          matches.push({ file: path.basename(filePath), content: text, score });
        }
      } catch {
        // Skip files that can't be read
      }
    }

    if (matches.length === 0) {
      const fileNames = featureFiles.map((f) => `- ${path.basename(f)}`).join('\n');
      return `No feature specs found matching keywords: ${keywords.join(', ')}\n\nAvailable feature files:\n${fileNames}`;
    }

    // Sort by score (highest first) and return top matches
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, MAX_FEATURE_RESULTS);

    let result = `Found ${matches.length} relevant feature spec(s) for keywords: ${keywords.join(', ')}\n\n`;
    result += '**CRITICAL: Apply these feature specs — they contain requirements and acceptance criteria.**\n\n';

    for (const match of topMatches) {
      result += `### ${match.file}\n${match.content}\n\n`;
    }

    if (matches.length > MAX_FEATURE_RESULTS) {
      result += `\n(${matches.length - MAX_FEATURE_RESULTS} additional matches not shown)`;
    }

    return result;
  } catch (error) {
    logError('[Naide] Error searching features:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error searching features: ${errorMessage}`;
  }
}

/**
 * Recursively reads all file paths in the features directory
 * @param dir - The directory URI to read
 * @returns Array of full file paths (as strings)
 */
async function readFeaturesDirectoryRecursive(dir: vscode.Uri): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await vscode.workspace.fs.readDirectory(dir);

    for (const [name, type] of entries) {
      const fullPath = vscode.Uri.joinPath(dir, name);

      if (type === vscode.FileType.Directory) {
        const subFiles = await readFeaturesDirectoryRecursive(fullPath);
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
