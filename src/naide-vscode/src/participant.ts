/**
 * Chat participant registration and request handling for Naide
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { loadSystemPrompts, loadSpecFiles, loadFeatureFiles } from './prompts';
import { getModeFromCommand } from './modes';
import { logInfo, logError, logWarn } from './logger';

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

    stream.progress('Loading feature files...');
    const features = await loadFeatureFiles(workspaceFolder.uri);
    logInfo(`[Naide] Features loaded: ${features.length} characters`);

    // Assemble full instructions
    const instructions = [systemPrompt, specs, features].filter(Boolean).join('\n\n');

    logInfo(`[Naide] Total assembled instructions: ${instructions.length} characters`);

    // Reference the search_learnings tool so Copilot can use it
    const allTools = await vscode.lm.tools;
    logInfo(`[Naide] Total tools available: ${allTools.length}`);
    allTools.forEach(tool => {
      logInfo(`[Naide]   - ${tool.name}`);
    });
    
    // Check if our custom search_learnings tool is registered
    const learningsTool = allTools.filter((tool) => tool.name === 'naide_searchLearnings');

    if (learningsTool.length > 0) {
      logInfo('[Naide] search_learnings tool available');
    } else {
      logWarn('[Naide] search_learnings tool not found (but other tools are available)');
    }

    // Build conversation history from context
    const messages: vscode.LanguageModelChatMessage[] = [];
    
    // Add previous conversation history if available
    if (context.history && context.history.length > 0) {
      logInfo(`[Naide] Processing ${context.history.length} previous turns`);
      
      // Convert chat history to language model messages
      for (let i = 0; i < context.history.length; i++) {
        const turn = context.history[i];
        if (turn instanceof vscode.ChatRequestTurn) {
          // User message
          logInfo(`[Naide]   Turn ${i + 1}: User request - "${turn.prompt.substring(0, 50)}..."`);
          messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
        } else if (turn instanceof vscode.ChatResponseTurn) {
          // Assistant message - extract text from response
          const responseText = turn.response.map(part => {
            if (part instanceof vscode.ChatResponseMarkdownPart) {
              return part.value.value;
            }
            return '';
          }).join('');
          
          if (responseText) {
            logInfo(`[Naide]   Turn ${i + 1}: Assistant response - ${responseText.length} chars`);
            messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
          }
        }
      }
    } else {
      logInfo('[Naide] No previous conversation history');
    }

    // Add system instructions with the current user message
    // System instructions are prepended to the first user message in the conversation
    // or to the current message if this is the first turn
    // IMPORTANT: Add workspace context to instructions
    const workspaceContext = workspaceRoot 
      ? `\n\n**WORKSPACE ROOT**: \`${workspaceRoot}\`\n**CRITICAL**: All file and directory paths MUST be relative to this workspace root. Use relative paths like \`.prompts/features/file.md\` (NOT absolute paths).\n`
      : '';
    const fullInstructions = `${instructions}${workspaceContext}`;
    
    const fullPrompt = messages.length === 0 
      ? `${fullInstructions}\n\n---\n\nUser Request: ${request.prompt}`
      : request.prompt;
    
    // If we have history, prepend instructions to the first message
    if (messages.length > 0 && messages[0].role === vscode.LanguageModelChatMessageRole.User) {
      const firstMessage = messages[0];
      // Extract text from the first message's content
      let firstMessageText = '';
      for (const part of firstMessage.content) {
        if (part instanceof vscode.LanguageModelTextPart) {
          firstMessageText += part.value;
        }
      }
      messages[0] = vscode.LanguageModelChatMessage.User(
        `${fullInstructions}\n\n---\n\n${firstMessageText}`
      );
    }
    
    // Add the current user message
    messages.push(vscode.LanguageModelChatMessage.User(fullPrompt));
    
    logInfo(`[Naide] Built message array with ${messages.length} messages`);
    logInfo(`[Naide] Current request prompt: "${request.prompt.substring(0, 100)}${request.prompt.length > 100 ? '...' : ''}"`);

    // Note: workspaceRoot is already defined and logged earlier in the function

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
        
        // Chat participants should pass undefined for toolInvocationToken
        // Only language model tools use toolInvocationToken when calling other tools
        const toolResult = await vscode.lm.invokeTool(
          toolCall.name,
          {
            input: resolvedInput,
            toolInvocationToken: undefined
          },
          token
        );

        logInfo(`[Naide]   Tool invocation started, processing result...`);

        // Collect the tool result content with robust handling
        const resultContent: string[] = [];
        let hasContent = false;
        
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
              hasContent = true;
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
        const promptsMatch = filePath.match(/[\\\/]\.prompts[\\\/].*/i);
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
        const promptsMatch = dirPath.match(/[\\\/]\.prompts[\\\/]?.*/i);
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

