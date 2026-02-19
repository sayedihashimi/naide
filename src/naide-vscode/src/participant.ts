/**
 * Chat participant registration and request handling for Naide
 */

import * as vscode from 'vscode';
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
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) {
    stream.markdown('❌ Please open a workspace folder to use @naide.');
    return;
  }

  try {
    logInfo('='.repeat(80));
    logInfo('[Naide] ===== NEW CHAT REQUEST =====');
    logInfo(`[Naide] Command: ${request.command || '(none - default mode)'}`);
    logInfo(`[Naide] Prompt: ${request.prompt}`);
    logInfo(`[Naide] Workspace: ${workspaceRoot.fsPath}`);
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
    const specs = await loadSpecFiles(workspaceRoot);
    logInfo(`[Naide] Specs loaded: ${specs.length} characters`);

    stream.progress('Loading feature files...');
    const features = await loadFeatureFiles(workspaceRoot);
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
    const fullPrompt = messages.length === 0 
      ? `${instructions}\n\n---\n\nUser Request: ${request.prompt}`
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
        `${instructions}\n\n---\n\n${firstMessageText}`
      );
    }
    
    // Add the current user message
    messages.push(vscode.LanguageModelChatMessage.User(fullPrompt));
    
    logInfo(`[Naide] Built message array with ${messages.length} messages`);
    logInfo(`[Naide] Current request prompt: "${request.prompt.substring(0, 100)}${request.prompt.length > 100 ? '...' : ''}"`);

    // Select language model - prefer Claude Opus 4.5, fallback to any available
    stream.progress('Requesting language model...');
    
    // Try to get Claude Opus 4.5 first
    let models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'claude-opus'
    });
    
    // If no Claude Opus models, try any Claude model
    if (models.length === 0) {
      logInfo('[Naide] Claude Opus not available, trying any Claude model...');
      models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'claude'
      });
    }
    
    // If no Claude models, fallback to GPT-4o
    if (models.length === 0) {
      logInfo('[Naide] No Claude models available, falling back to GPT-4o...');
      models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });
    }
    
    // If still no models, try any Copilot model
    if (models.length === 0) {
      logInfo('[Naide] No specific models available, trying any Copilot model...');
      models = await vscode.lm.selectChatModels({
        vendor: 'copilot'
      });
    }

    if (models.length === 0) {
      logError('[Naide] No language models available!');
      stream.markdown('❌ No language model available. Ensure GitHub Copilot is active.');
      return;
    }

    logInfo(`[Naide] Selected model: ${models[0].id} (${models[0].name})`);
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
      token
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
  token: vscode.CancellationToken
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
        logInfo(`[Naide]   Input: ${JSON.stringify(toolCall.input)}`);
        stream.progress(`Executing ${toolCall.name}...`);
        
        // Chat participants should pass undefined for toolInvocationToken
        // Only language model tools use toolInvocationToken when calling other tools
        const toolResult = await vscode.lm.invokeTool(
          toolCall.name,
          {
            input: toolCall.input,
            toolInvocationToken: undefined
          },
          token
        );

        logInfo(`[Naide]   Tool invocation completed, processing result...`);

        // Collect the tool result content
        const resultContent: string[] = [];
        for await (const contentPart of toolResult.content) {
          if (contentPart instanceof vscode.LanguageModelTextPart) {
            resultContent.push(contentPart.value);
            logInfo(`[Naide]     Result content: ${contentPart.value.substring(0, 100)}`);
          }
        }

        toolResults.push(
          new vscode.LanguageModelToolResultPart(
            toolCall.callId,
            resultContent.map(content => new vscode.LanguageModelTextPart(content))
          )
        );

        logInfo(`[Naide]   ✓ Tool ${toolCall.name} completed successfully`);
        logInfo(`[Naide]     Result parts: ${resultContent.length}`);
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
