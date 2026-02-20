/**
 * Chat participant registration and request handling for Naide
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { loadSystemPrompts, loadSpecFiles } from './prompts';
import { getModeFromCommand } from './modes';
import { logInfo, logError, logWarn } from './logger';
import { searchLearnings } from './learnings';
import { searchFeatures } from './features';

/**
 * Registers the @naide chat participant
 * @param extensionContext - The extension context
 */
export function registerNaideParticipant(extensionContext: vscode.ExtensionContext): void {
  // Create handler with access to extension context
  const handler = createHandler(extensionContext);
  
  const participant = vscode.chat.createChatParticipant('naide.chat', handler);
  
  // Set the icon if available
  const iconPath = vscode.Uri.joinPath(extensionContext.extensionUri, 'icon.png');
  participant.iconPath = iconPath;
  
  extensionContext.subscriptions.push(participant);
  logInfo('[Naide] Registered @naide chat participant');
}

/**
 * Creates a chat request handler with access to extension context
 * @param extensionContext - The extension context
 * @returns Chat request handler
 */
function createHandler(extensionContext: vscode.ExtensionContext): vscode.ChatRequestHandler {
  return async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
  // Check for workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    stream.markdown('❌ Please open a workspace folder to use @naide.');
    return;
  }
  
  // Get workspace root as string for path resolution
  const workspaceRoot = workspaceFolder.uri.fsPath;

  try {
    logInfo('='.repeat(80));
    logInfo('[Naide] ===== NEW CHAT REQUEST =====');
    logInfo(`[Naide] Command: ${request.command || '(none - default mode)'}`);
    logInfo(`[Naide] Prompt: ${request.prompt}`);
    logInfo(`[Naide] Workspace: ${workspaceRoot}`);
    logInfo(`[Naide] History length: ${context.history?.length || 0}`);
    
    // Determine mode from slash command
    const mode = getModeFromCommand(request.command);
    logInfo(`[Naide] Mode determined: ${mode}`);

    // Show progress
    stream.progress('Loading Naide context...');

    // Load system prompts and context
    stream.progress('Loading system prompts...');
    const systemPrompt = await loadSystemPrompts(extensionContext, mode);
    logInfo(`[Naide] System prompts loaded: ${systemPrompt.length} characters`);

    stream.progress('Loading project specifications...');
    const specs = await loadSpecFiles(workspaceFolder.uri);
    logInfo(`[Naide] Specs loaded: ${specs.length} characters`);

    // Assemble system instructions (without feature files — loaded on demand via tool)
    const workspaceContext = workspaceRoot
      ? `\n\n**WORKSPACE ROOT**: \`${workspaceRoot}\`\n**CRITICAL**: All file and directory paths MUST be relative to this workspace root. Use relative paths like \`.prompts/features/file.md\` (NOT absolute paths).\n`
      : '';
    const instructions = [systemPrompt, specs, workspaceContext].filter(Boolean).join('\n\n');

    logInfo(`[Naide] Total assembled instructions: ${instructions.length} characters`);

    // Reference the search_learnings tool so Copilot can use it
    const vscodeLmTools = await vscode.lm.tools;
    logInfo(`[Naide] Total tools available: ${vscodeLmTools.length}`);
    vscodeLmTools.forEach(tool => {
      logInfo(`[Naide]   - ${tool.name}`);
    });
    
    // Check if our custom tools are registered
    const hasLearningsTool = vscodeLmTools.some((tool) => tool.name === 'naide_searchLearnings');
    const hasFeaturesTool = vscodeLmTools.some((tool) => tool.name === 'naide_searchFeatures');

    // Build mutable tools array, ensuring naide_searchLearnings and naide_searchFeatures are always included.
    // The tool implementations are registered via registerTool() but VS Code may not expose
    // an extension's own tools in vscode.lm.tools, so we add the descriptors manually.
    const allTools: vscode.LanguageModelChatTool[] = [...vscodeLmTools];

    if (hasLearningsTool) {
      logInfo('[Naide] naide_searchLearnings found in vscode.lm.tools ✓');
    } else {
      logWarn('[Naide] naide_searchLearnings NOT found in vscode.lm.tools - adding descriptor manually');
      allTools.push({
        name: 'naide_searchLearnings',
        description: 'Search project learnings (.prompts/learnings/) for relevant context based on keywords. Returns matching learnings that contain corrections, constraints, and past decisions.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords to search for in learnings (e.g., [\'react\', \'testing\'])'
            }
          },
          required: ['keywords']
        }
      });
      logInfo(`[Naide] naide_searchLearnings descriptor added manually (allTools now has ${allTools.length} tools)`);
    }

    if (hasFeaturesTool) {
      logInfo('[Naide] naide_searchFeatures found in vscode.lm.tools ✓');
    } else {
      logWarn('[Naide] naide_searchFeatures NOT found in vscode.lm.tools - adding descriptor manually');
      allTools.push({
        name: 'naide_searchFeatures',
        description: 'Search project feature specifications (.prompts/features/) for relevant context based on keywords. Returns matching feature specs that contain requirements, acceptance criteria, and implementation details.',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords to search for in feature files (e.g., [\'chat\', \'history\', \'token\'])'
            }
          },
          required: ['keywords']
        }
      });
      logInfo(`[Naide] naide_searchFeatures descriptor added manually (allTools now has ${allTools.length} tools)`);
    }

    // Log the final tool list that will be passed to the model
    const hasLearningsInFinal = allTools.some(t => t.name === 'naide_searchLearnings');
    const hasFeaturesInFinal = allTools.some(t => t.name === 'naide_searchFeatures');
    logInfo(`[Naide] Final tool list for model: ${allTools.length} tools, naide_searchLearnings included: ${hasLearningsInFinal}, naide_searchFeatures included: ${hasFeaturesInFinal}`);


    // Build conversation history from context (with truncation to avoid token limit)
    const messages: vscode.LanguageModelChatMessage[] = [];

    // Insert system instructions as the first dedicated message
    messages.push(vscode.LanguageModelChatMessage.User(
      `[SYSTEM INSTRUCTIONS]\n\n${instructions}`
    ));
    logInfo(`[Naide] System message inserted (${instructions.length} chars)`);

    // Add previous conversation history (truncated to budget)
    if (context.history && context.history.length > 0) {
      logInfo(`[Naide] Processing ${context.history.length} previous turns`);
      const historyMessages = truncateHistory(context.history);
      messages.push(...historyMessages);
      logInfo(`[Naide] Added ${historyMessages.length} history messages (after truncation)`);
    } else {
      logInfo('[Naide] No previous conversation history');
    }

    // Add the current user message (prompt only — no instructions prepended)
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
    
    logInfo(`[Naide] Built message array with ${messages.length} messages`);
    logInfo(`[Naide] Current request prompt: "${request.prompt.substring(0, 100)}${request.prompt.length > 100 ? '...' : ''}"`);

    // Select language model - prefer Claude Opus, fallback to any available
    stream.progress('Requesting language model...');
    
    // First, get all available models to see what we have
    const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    logInfo(`[Naide] Available Copilot models: ${allModels.length}`);
    for (const model of allModels) {
      logInfo(`[Naide]   - id: ${model.id}, family: "${model.family}", name: "${model.name}"`);
    }
    
    let models: vscode.LanguageModelChat[] = [];
    
    // Try to get Claude Opus - check family for "opus" (case-insensitive)
    // Family might be "claude-opus", "claude_opus", "opus", etc.
    models = allModels.filter(m => {
      const family = m.family.toLowerCase();
      const name = m.name.toLowerCase();
      return family.includes('opus') || name.includes('opus');
    });
    
    if (models.length > 0) {
      logInfo(`[Naide] ✓ Found ${models.length} Opus model(s), using: ${models[0].id}`);
    } else {
      // Try any Claude model (sonnet, etc.)
      logInfo('[Naide] Claude Opus not available, trying any Claude model...');
      models = allModels.filter(m => {
        const family = m.family.toLowerCase();
        const name = m.name.toLowerCase();
        return family.includes('claude') || name.includes('claude');
      });
      
      if (models.length > 0) {
        logInfo(`[Naide] ✓ Found ${models.length} Claude model(s), using: ${models[0].id}`);
      } else {
        // Fallback to GPT-4o
        logInfo('[Naide] No Claude models available, falling back to GPT-4o...');
        models = allModels.filter(m => {
          const family = m.family.toLowerCase();
          return family.includes('gpt') || family.includes('4o');
        });
        
        if (models.length === 0) {
          // Last resort: use any available model
          logInfo('[Naide] No specific models available, using first available model...');
          models = allModels;
        }
      }
    }

    if (models.length === 0) {
      logError('[Naide] No language models available!');
      stream.markdown('❌ No language model available. Ensure GitHub Copilot is active and you have access to language models.');
      return;
    }

    logInfo(`[Naide] ═══ Selected model: ${models[0].id} (${models[0].name}, family: ${models[0].family}) ═══`);
    logInfo(`[Naide] Passing all ${allTools.length} tools to model`);

    // Send request to language model
    stream.progress('Generating response...');
    logInfo('[Naide] Calling handleLanguageModelConversation...');
    
    // Handle the language model conversation with tool support
    // Pass ALL tools so the model can use file creation tools
    // Convert readonly array to mutable array
    await handleLanguageModelConversation(
      models[0],
      messages,
      [...allTools],
      request,
      stream,
      token,
      workspaceRoot
    );

    logInfo('[Naide] ===== CONVERSATION COMPLETED =====');
    logInfo('='.repeat(80));
  } catch (error) {
    logError('[Naide] Error handling chat request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    stream.markdown(`❌ Error: ${errorMessage}\n\n`);
    
    // Provide helpful error messages
    if (errorMessage.includes('model') || errorMessage.includes('Copilot')) {
      stream.markdown('Make sure GitHub Copilot is installed and active.');
    } else if (errorMessage.includes('workspace')) {
      stream.markdown('Make sure you have a workspace folder open.');
    } else {
      stream.markdown('Please check the console for more details.');
    }
  }
};
}

/**
 * Manually create a file using VS Code's file system API.
 * This is a workaround for the copilot_createFile tool bug that causes "Invalid stream" errors.
 */
async function manuallyCreateFile(filePath: string, content: string): Promise<void> {
  logInfo(`[Naide]   🔧 Manual file creation (workaround for copilot_createFile bug)`);
  logInfo(`[Naide]   Creating: ${filePath}`);
  
  const fileUri = vscode.Uri.file(filePath);
  const dirUri = vscode.Uri.file(path.dirname(filePath));
  
  // Ensure parent directory exists (recursive creation)
  await vscode.workspace.fs.createDirectory(dirUri);
  
  // Convert content string to bytes and write file
  const contentBytes = new TextEncoder().encode(content);
  await vscode.workspace.fs.writeFile(fileUri, contentBytes);
  
  logInfo(`[Naide]   ✅ File created successfully using VS Code file system API`);
}

/**
 * Handles the language model conversation with tool invocation support
 * This function manages the back-and-forth with the LM when tools are called
 */
async function handleLanguageModelConversation(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[],
  tools: vscode.LanguageModelChatTool[],
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  workspaceRoot?: string
): Promise<void> {
  logInfo('[Naide] --- Starting language model conversation handler ---');
  logInfo(`[Naide] Initial messages: ${messages.length}`);
  logInfo(`[Naide] Tools available: ${tools.length}`);
  if (tools.length > 0) {
    tools.forEach(tool => logInfo(`[Naide]   Tool: ${tool.name}`));
  }
  
  // Keep track of the conversation messages
  const conversationMessages = [...messages];
  
  // Maximum number of tool invocation rounds to prevent infinite loops
  const maxRounds = 10;
  let round = 0;
  
  while (round < maxRounds && !token.isCancellationRequested) {
    round++;
    logInfo(`[Naide] -------- Round ${round}/${maxRounds} --------`);
    logInfo(`[Naide] Sending ${conversationMessages.length} messages to model`);
    
    const chatRequest = await model.sendRequest(
      conversationMessages,
      {
        justification: 'Naide provides spec-driven development assistance with project context',
        tools: tools
      },
      token
    );

    const toolCalls: vscode.LanguageModelToolCallPart[] = [];
    let textPartCount = 0;
    let otherPartCount = 0;

    logInfo('[Naide] Processing response stream...');
    
    // Process the response stream
    for await (const part of chatRequest.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        // Stream text to the user
        stream.markdown(part.value);
        textPartCount++;
        if (textPartCount <= 3) {
          logInfo(`[Naide]   Text part ${textPartCount}: "${part.value.substring(0, 50)}..."`);
        }
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        // Collect tool calls for invocation
        toolCalls.push(part);
        logInfo(`[Naide]   ⚡ Tool call detected: ${part.name} (callId: ${part.callId})`);
        logInfo(`[Naide]      Input: ${JSON.stringify(part.input).substring(0, 200)}`);
      } else {
        otherPartCount++;
        logInfo(`[Naide]   Unknown part type: ${part?.constructor?.name || typeof part}`);
      }
    }

    logInfo(`[Naide] Stream processing complete:`);
    logInfo(`[Naide]   - Text parts: ${textPartCount}`);
    logInfo(`[Naide]   - Tool calls: ${toolCalls.length}`);
    logInfo(`[Naide]   - Other parts: ${otherPartCount}`);

    // If there are no tool calls, we're done
    if (toolCalls.length === 0) {
      logInfo(`[Naide] ✓ No tool calls in this round - conversation complete`);
      break;
    }

    logInfo(`[Naide] Processing ${toolCalls.length} tool call(s)...`);

    // Add assistant message with tool calls to conversation
    conversationMessages.push(
      vscode.LanguageModelChatMessage.Assistant(toolCalls)
    );
    logInfo(`[Naide] Added assistant message with ${toolCalls.length} tool calls`);

    // Invoke each tool and collect results
    const toolResults: vscode.LanguageModelToolResultPart[] = [];
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      try {
        logInfo(`[Naide] [${i + 1}/${toolCalls.length}] Invoking tool: ${toolCall.name}`);
        logInfo(`[Naide]   Call ID: ${toolCall.callId}`);
        
        // Resolve relative paths to absolute paths for file/directory operations
        let resolvedInput = toolCall.input;
        let pathWasResolved = false;
        if (workspaceRoot && (toolCall.name === 'copilot_createFile' || toolCall.name === 'copilot_createDirectory')) {
          const result = resolveToolPaths(toolCall.input, workspaceRoot, toolCall.name);
          resolvedInput = result.input;
          pathWasResolved = result.changed;
          if (pathWasResolved) {
            logInfo(`[Naide]   🔄 Path resolved to workspace: ${result.originalPath} → ${result.resolvedPath}`);
          }
        }
        
        logInfo(`[Naide]   Input: ${JSON.stringify(resolvedInput).substring(0, 200)}`);
        stream.progress(`Executing ${toolCall.name}...`);
        
        // naide_searchLearnings: invoke directly because vscode.lm.invokeTool() cannot
        // invoke a tool that was added manually to the tools list (not from vscode.lm.tools).
        if (toolCall.name === 'naide_searchLearnings') {
          try {
            const input = resolvedInput as { keywords?: string[] };
            const keywords = Array.isArray(input?.keywords) ? input.keywords : [];
            logInfo(`[Naide]   Invoking searchLearnings directly, keywords: ${JSON.stringify(keywords)}`);
            const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
            const learningsResult = workspaceUri
              ? await searchLearnings(workspaceUri, keywords)
              : 'No workspace open.';
            toolResults.push(
              new vscode.LanguageModelToolResultPart(
                toolCall.callId,
                [new vscode.LanguageModelTextPart(learningsResult)]
              )
            );
            logInfo(`[Naide]   ✓ naide_searchLearnings completed (${learningsResult.length} chars)`);
          } catch (learningsError: any) {
            logError(`[Naide]   ✗ Error in naide_searchLearnings: ${learningsError.message}`);
            toolResults.push(
              new vscode.LanguageModelToolResultPart(
                toolCall.callId,
                [new vscode.LanguageModelTextPart(`Error searching learnings: ${learningsError.message}`)]
              )
            );
          }
          continue; // Skip standard tool invocation for this tool
        }

        // naide_searchFeatures: invoke directly (same pattern as naide_searchLearnings)
        if (toolCall.name === 'naide_searchFeatures') {
          try {
            const input = resolvedInput as { keywords?: string[] };
            const keywords = Array.isArray(input?.keywords) ? input.keywords : [];
            logInfo(`[Naide]   Invoking searchFeatures directly, keywords: ${JSON.stringify(keywords)}`);
            const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
            const featuresResult = workspaceUri
              ? await searchFeatures(workspaceUri, keywords)
              : 'No workspace open.';
            toolResults.push(
              new vscode.LanguageModelToolResultPart(
                toolCall.callId,
                [new vscode.LanguageModelTextPart(featuresResult)]
              )
            );
            logInfo(`[Naide]   ✓ naide_searchFeatures completed (${featuresResult.length} chars)`);
          } catch (featuresError: any) {
            logError(`[Naide]   ✗ Error in naide_searchFeatures: ${featuresError.message}`);
            toolResults.push(
              new vscode.LanguageModelToolResultPart(
                toolCall.callId,
                [new vscode.LanguageModelTextPart(`Error searching features: ${featuresError.message}`)]
              )
            );
          }
          continue; // Skip standard tool invocation for this tool
        }
        
        // Workaround for copilot_createFile bug: handle file creation manually
        if (toolCall.name === 'copilot_createFile' && 
            (resolvedInput as any).filePath && 
            (resolvedInput as any).content) {
          try {
            await manuallyCreateFile(
              (resolvedInput as any).filePath, 
              (resolvedInput as any).content
            );
            
            // Return success result without invoking the broken tool
            toolResults.push(
              new vscode.LanguageModelToolResultPart(
                toolCall.callId,
                [new vscode.LanguageModelTextPart(
                  `File created at ${(resolvedInput as any).filePath}`
                )]
              )
            );
            logInfo(`[Naide]   ✓ Tool copilot_createFile completed (via manual implementation)`);
          } catch (fileError: any) {
            logError(`[Naide]   ✗ Error in manual file creation: ${fileError.message}`);
            toolResults.push(
              new vscode.LanguageModelToolResultPart(
                toolCall.callId,
                [new vscode.LanguageModelTextPart(
                  `Error creating file: ${fileError.message}`
                )]
              )
            );
          }
          continue; // Skip standard tool invocation for this tool
        }
        
        // All other tools: use standard invocation
        // Pass request.toolInvocationToken to associate invocations with the chat context.
        // This ensures tool confirmations (e.g. "Run command?") are shown inside the
        // Copilot chat panel rather than as native OS dialog pop-ups.
        const toolResult = await vscode.lm.invokeTool(
          toolCall.name,
          {
            input: resolvedInput,
            toolInvocationToken: request.toolInvocationToken
          },
          token
        );

        logInfo(`[Naide]   Tool invocation started, processing result...`);

        // Collect the tool result content with robust handling
        const resultContent: string[] = [];
        
        try {
          // Set a timeout for result processing
          const timeoutMs = 30000; // 30 seconds
          const startTime = Date.now();
          
          for await (const contentPart of toolResult.content) {
            if (Date.now() - startTime > timeoutMs) {
              logWarn(`[Naide]     Warning: Tool result processing timeout after ${timeoutMs}ms`);
              break;
            }
            
            if (contentPart instanceof vscode.LanguageModelTextPart) {
              resultContent.push(contentPart.value);
              logInfo(`[Naide]     Result: ${contentPart.value.substring(0, 150)}${contentPart.value.length > 150 ? '...' : ''}`);
            } else {
              logInfo(`[Naide]     Result part type: ${contentPart?.constructor?.name || typeof contentPart}`);
            }
          }
        } catch (streamError: any) {
          logWarn(`[Naide]     Warning processing result stream: ${streamError.message}`);
          // Continue - some tools succeed without returning content
        }

        // Create tool result
        if (resultContent.length > 0) {
          toolResults.push(
            new vscode.LanguageModelToolResultPart(
              toolCall.callId,
              resultContent.map(content => new vscode.LanguageModelTextPart(content))
            )
          );
          logInfo(`[Naide]   ✓ Tool ${toolCall.name} completed with ${resultContent.length} result part(s)`);
        } else {
          // Tool succeeded but returned no content - create success message
          toolResults.push(
            new vscode.LanguageModelToolResultPart(
              toolCall.callId,
              [new vscode.LanguageModelTextPart(`Tool ${toolCall.name} executed successfully.`)]
            )
          );
          logInfo(`[Naide]   ✓ Tool ${toolCall.name} completed (no content returned, assuming success)`);
        }
      } catch (error) {
        logError(`[Naide]   ✗ Error invoking tool ${toolCall.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        logError(`[Naide]     Error message: ${errorMessage}`);
        if (errorStack) {
          logError(`[Naide]     Stack trace: ${errorStack}`);
        }
        
        // Add error as tool result
        toolResults.push(
          new vscode.LanguageModelToolResultPart(
            toolCall.callId,
            [new vscode.LanguageModelTextPart(`Error: ${errorMessage}`)]
          )
        );
      }
    }

    // Add tool results as a user message
    conversationMessages.push(
      vscode.LanguageModelChatMessage.User(toolResults)
    );

    logInfo(`[Naide] Added user message with ${toolResults.length} tool results`);
    logInfo(`[Naide] Continuing to next round...`);
  }

  if (round >= maxRounds) {
    logWarn(`[Naide] ⚠ Reached maximum rounds (${maxRounds}), stopping conversation loop`);
    stream.markdown('\n\n*Note: Reached maximum tool invocation rounds.*');
  } else {
    logInfo(`[Naide] Conversation ended naturally after ${round} rounds`);
  }
  logInfo('[Naide] --- Language model conversation handler complete ---');
}

/**
 * Resolve relative file paths to absolute paths based on workspace root.
 * Also validates and corrects absolute paths that aren't within the workspace.
 * This prevents "Invalid input path" errors from VS Code tools that require absolute paths.
 */
function resolveToolPaths(input: any, workspaceRoot: string, toolName: string): { input: any; changed: boolean; originalPath?: string; resolvedPath?: string } {
  if (!input || typeof input !== 'object') {
    return { input, changed: false };
  }

  const resolved = { ...input };
  let changed = false;
  let originalPath: string | undefined;
  let resolvedPath: string | undefined;

  // Normalize workspace root for comparison (handle both / and \ separators)
  const normalizedWorkspaceRoot = workspaceRoot.toLowerCase().replace(/\\/g, '/');

  // Handle copilot_createFile - has 'filePath' property
  if (toolName === 'copilot_createFile' && typeof resolved.filePath === 'string') {
    const filePath = resolved.filePath; // TypeScript knows this is string in this block
    originalPath = filePath;
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    
    if (path.isAbsolute(filePath)) {
      // Path is absolute - check if it's within workspace
      if (!normalizedPath.startsWith(normalizedWorkspaceRoot)) {
        // Absolute path outside workspace - extract relative part and re-resolve
        // Try to find .prompts or other recognizable patterns
        const promptsMatch = filePath.match(/[\\/]\.prompts[\\/].*/i);
        if (promptsMatch) {
          // Extract from .prompts onwards and treat as relative
          const relativePart = promptsMatch[0].substring(1); // Remove leading slash
          resolved.filePath = path.join(workspaceRoot, relativePart);
          resolvedPath = resolved.filePath;
          changed = true;
          logWarn(`[Naide]   ⚠ Corrected absolute path outside workspace`);
        } else {
          logWarn(`[Naide]   ⚠ Absolute path outside workspace - may fail: ${filePath}`);
        }
      }
    } else {
      // Path is relative - resolve to workspace
      resolved.filePath = path.join(workspaceRoot, filePath);
      resolvedPath = resolved.filePath;
      changed = true;
    }
  }

  // Handle copilot_createDirectory - has 'dirPath' property
  if (toolName === 'copilot_createDirectory' && typeof resolved.dirPath === 'string') {
    const dirPath = resolved.dirPath; // TypeScript knows this is string in this block
    originalPath = dirPath;
    const normalizedPath = dirPath.toLowerCase().replace(/\\/g, '/');
    
    if (path.isAbsolute(dirPath)) {
      // Path is absolute - check if it's within workspace
      if (!normalizedPath.startsWith(normalizedWorkspaceRoot)) {
        // Absolute path outside workspace - extract relative part and re-resolve
        const promptsMatch = dirPath.match(/[\\/]\.prompts[\\/]?.*/i);
        if (promptsMatch) {
          // Extract from .prompts onwards and treat as relative
          const relativePart = promptsMatch[0].substring(1); // Remove leading slash
          resolved.dirPath = path.join(workspaceRoot, relativePart);
          resolvedPath = resolved.dirPath;
          changed = true;
          logWarn(`[Naide]   ⚠ Corrected absolute path outside workspace`);
        } else {
          logWarn(`[Naide]   ⚠ Absolute path outside workspace - may fail: ${dirPath}`);
        }
      }
    } else {
      // Path is relative - resolve to workspace
      resolved.dirPath = path.join(workspaceRoot, dirPath);
      resolvedPath = resolved.dirPath;
      changed = true;
    }
  }

  return { input: resolved, changed, originalPath, resolvedPath };
}

/**
 * Maximum total character length of conversation history (proxy for token budget).
 * Assumes ~4 characters per token; 12,000 chars ≈ 3,000 tokens.
 * Most models have 32K–128K token limits; this keeps history well within budget.
 */
const HISTORY_BUDGET_CHARS = 12000;

/**
 * Maximum character length of the generated conversation summary.
 * ~2,000 chars ≈ 500 tokens — compact enough to preserve budget headroom.
 */
const MAX_SUMMARY_CHARS = 2000;

/** Maximum character length of each extracted user topic snippet. */
const MAX_TOPIC_LENGTH = 80;

/** Maximum number of decision/key-point items extracted from assistant responses. */
const MAX_DECISION_POINTS = 10;

/** Maximum character length of each extracted decision/key-point item. */
const MAX_DECISION_POINT_LENGTH = 100;

/**
 * Truncates conversation history to fit within token budget.
 * Keeps the last 2 user turns verbatim and summarizes earlier history.
 *
 * @param history - The chat context history
 * @returns Array of language model messages representing the (possibly truncated) history
 */
function truncateHistory(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): vscode.LanguageModelChatMessage[] {
  // Convert all turns to simple message objects
  const rawMessages: Array<{ role: 'user' | 'assistant'; text: string }> = [];

  for (const turn of history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      rawMessages.push({ role: 'user', text: turn.prompt });
    } else if (turn instanceof vscode.ChatResponseTurn) {
      const responseText = turn.response
        .map(part => (part instanceof vscode.ChatResponseMarkdownPart ? part.value.value : ''))
        .join('');
      if (responseText) {
        rawMessages.push({ role: 'assistant', text: responseText });
      }
    }
  }

  // Measure total character length
  const totalChars = rawMessages.reduce((sum, m) => sum + m.text.length, 0);
  logInfo(`[Naide] History total chars: ${totalChars} (budget: ${HISTORY_BUDGET_CHARS})`);

  if (totalChars <= HISTORY_BUDGET_CHARS) {
    // Within budget — return all messages as-is
    return rawMessages.map(m =>
      m.role === 'user'
        ? vscode.LanguageModelChatMessage.User(m.text)
        : vscode.LanguageModelChatMessage.Assistant(m.text)
    );
  }

  // Over budget: keep last 2 user turns (and their paired assistant responses)
  // Identify the last 2 user message indices
  const userIndices: number[] = [];
  for (let i = rawMessages.length - 1; i >= 0 && userIndices.length < 2; i--) {
    if (rawMessages[i].role === 'user') {
      userIndices.unshift(i);
    }
  }

  // The "recent" window starts at the earliest of those user turns
  const recentStartIndex = userIndices.length > 0 ? userIndices[0] : rawMessages.length;
  const olderMessages = rawMessages.slice(0, recentStartIndex);
  const recentMessages = rawMessages.slice(recentStartIndex);

  logInfo(`[Naide] History truncation: ${olderMessages.length} older msgs → summary, ${recentMessages.length} recent msgs kept verbatim`);

  const result: vscode.LanguageModelChatMessage[] = [];

  if (olderMessages.length > 0) {
    const summary = summarizeOlderMessages(olderMessages);
    result.push(vscode.LanguageModelChatMessage.User(summary));
  }

  for (const m of recentMessages) {
    result.push(
      m.role === 'user'
        ? vscode.LanguageModelChatMessage.User(m.text)
        : vscode.LanguageModelChatMessage.Assistant(m.text)
    );
  }

  return result;
}

/**
 * Generates a compact summary of older conversation messages.
 * Extracts topics, decisions, and key context. Caps at 2,000 characters.
 *
 * @param messages - The older messages to summarize
 * @returns Formatted summary string
 */
function summarizeOlderMessages(
  messages: Array<{ role: 'user' | 'assistant'; text: string }>
): string {
  const topics: string[] = [];
  const decisions: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Extract topic from first ~MAX_TOPIC_LENGTH chars of each user message
      const topic = msg.text.trim().substring(0, MAX_TOPIC_LENGTH).replace(/\n/g, ' ');
      if (topic) {
        topics.push(topic);
      }
    } else {
      // Extract key points from assistant responses: look for bullet/numbered list items
      const lines = msg.text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[-*•]\s+.+/.test(trimmed) || /^\d+\.\s+.+/.test(trimmed)) {
          const point = trimmed.substring(0, MAX_DECISION_POINT_LENGTH);
          if (point && decisions.length < MAX_DECISION_POINTS) {
            decisions.push(point);
          }
        }
      }
    }
  }

  let summary = '[CONVERSATION SUMMARY - Earlier messages summarized to save context space]\n\n';

  if (topics.length > 0) {
    summary += 'Topics discussed:\n';
    summary += topics.map(t => `- ${t}`).join('\n') + '\n\n';
  }

  if (decisions.length > 0) {
    summary += 'Key points from earlier responses:\n';
    summary += decisions.map(d => `- ${d}`).join('\n') + '\n\n';
  }

  // Cap at MAX_SUMMARY_CHARS characters
  if (summary.length > MAX_SUMMARY_CHARS) {
    summary = summary.substring(0, MAX_SUMMARY_CHARS - 3) + '...';
  }

  logInfo(`[Naide] History summary generated: ${summary.length} chars`);
  return summary;
}

