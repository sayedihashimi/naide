/**
 * Chat participant registration and request handling for Naide
 */

import * as vscode from 'vscode';
import { loadSystemPrompts, loadSpecFiles, loadFeatureFiles } from './prompts';
import { getModeFromCommand } from './modes';

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
  console.log('[Naide] Registered @naide chat participant');
  console.log('[Naide] TIP: Open "Output" panel and select "GitHub Copilot Chat" to see detailed logs');
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
    console.log('='.repeat(80));
    console.log('[Naide] ===== NEW CHAT REQUEST =====');
    console.log(`[Naide] Command: ${request.command || '(none - default mode)'}`);
    console.log(`[Naide] Prompt: ${request.prompt}`);
    console.log(`[Naide] Workspace: ${workspaceRoot.fsPath}`);
    console.log(`[Naide] History length: ${context.history?.length || 0}`);
    
    // Determine mode from slash command
    const mode = getModeFromCommand(request.command);
    console.log(`[Naide] Mode determined: ${mode}`);

    // Show progress
    stream.progress('Loading Naide context...');

    // Load system prompts and context
    stream.progress('Loading system prompts...');
    const systemPrompt = await loadSystemPrompts(extensionContext, mode);
    console.log(`[Naide] System prompts loaded: ${systemPrompt.length} characters`);

    stream.progress('Loading project specifications...');
    const specs = await loadSpecFiles(workspaceRoot);
    console.log(`[Naide] Specs loaded: ${specs.length} characters`);

    stream.progress('Loading feature files...');
    const features = await loadFeatureFiles(workspaceRoot);
    console.log(`[Naide] Features loaded: ${features.length} characters`);

    // Assemble full instructions
    const instructions = [systemPrompt, specs, features].filter(Boolean).join('\n\n');

    console.log(`[Naide] Total assembled instructions: ${instructions.length} characters`);

    // Reference the search_learnings tool so Copilot can use it
    const allTools = await vscode.lm.tools;
    console.log(`[Naide] Total tools available: ${allTools.length}`);
    allTools.forEach(tool => {
      console.log(`[Naide]   - ${tool.name}`);
    });
    
    const learningsTool = allTools.filter((tool) => tool.name === 'naide_searchLearnings');

    if (learningsTool.length > 0) {
      console.log('[Naide] search_learnings tool available');
    } else {
      console.warn('[Naide] search_learnings tool not found');
    }

    // Build conversation history from context
    const messages: vscode.LanguageModelChatMessage[] = [];
    
    // Add previous conversation history if available
    if (context.history && context.history.length > 0) {
      console.log(`[Naide] Processing ${context.history.length} previous turns`);
      
      // Convert chat history to language model messages
      for (let i = 0; i < context.history.length; i++) {
        const turn = context.history[i];
        if (turn instanceof vscode.ChatRequestTurn) {
          // User message
          console.log(`[Naide]   Turn ${i + 1}: User request - "${turn.prompt.substring(0, 50)}..."`);
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
            console.log(`[Naide]   Turn ${i + 1}: Assistant response - ${responseText.length} chars`);
            messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
          }
        }
      }
    } else {
      console.log('[Naide] No previous conversation history');
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
    
    console.log(`[Naide] Built message array with ${messages.length} messages`);
    console.log(`[Naide] Current request prompt: "${request.prompt.substring(0, 100)}${request.prompt.length > 100 ? '...' : ''}"`);

    // Select language model
    stream.progress('Requesting language model...');
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });

    if (models.length === 0) {
      console.error('[Naide] No language models available!');
      stream.markdown('❌ No language model available. Ensure GitHub Copilot is active.');
      return;
    }

    console.log(`[Naide] Selected model: ${models[0].id} (${models[0].name})`);
    console.log(`[Naide] Tools to pass to model: ${learningsTool.length}`);

    // Send request to language model
    stream.progress('Generating response...');
    console.log('[Naide] Calling handleLanguageModelConversation...');
    
    // Handle the language model conversation with tool support
    await handleLanguageModelConversation(
      models[0],
      messages,
      learningsTool,
      request,
      stream,
      token
    );

    console.log('[Naide] ===== CONVERSATION COMPLETED =====');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('[Naide] Error handling chat request:', error);
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
  console.log('[Naide] --- Starting language model conversation handler ---');
  console.log(`[Naide] Initial messages: ${messages.length}`);
  console.log(`[Naide] Tools available: ${tools.length}`);
  if (tools.length > 0) {
    tools.forEach(tool => console.log(`[Naide]   Tool: ${tool.name}`));
  }
  
  // Keep track of the conversation messages
  const conversationMessages = [...messages];
  
  // Maximum number of tool invocation rounds to prevent infinite loops
  const maxRounds = 10;
  let round = 0;
  
  while (round < maxRounds && !token.isCancellationRequested) {
    round++;
    console.log(`[Naide] -------- Round ${round}/${maxRounds} --------`);
    console.log(`[Naide] Sending ${conversationMessages.length} messages to model`);
    
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

    console.log('[Naide] Processing response stream...');
    
    // Process the response stream
    for await (const part of chatRequest.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        // Stream text to the user
        stream.markdown(part.value);
        textPartCount++;
        if (textPartCount <= 3) {
          console.log(`[Naide]   Text part ${textPartCount}: "${part.value.substring(0, 50)}..."`);
        }
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        // Collect tool calls for invocation
        toolCalls.push(part);
        console.log(`[Naide]   ⚡ Tool call detected: ${part.name} (callId: ${part.callId})`);
        console.log(`[Naide]      Input: ${JSON.stringify(part.input).substring(0, 200)}`);
      } else {
        otherPartCount++;
        console.log(`[Naide]   Unknown part type: ${part?.constructor?.name || typeof part}`);
      }
    }

    console.log(`[Naide] Stream processing complete:`);
    console.log(`[Naide]   - Text parts: ${textPartCount}`);
    console.log(`[Naide]   - Tool calls: ${toolCalls.length}`);
    console.log(`[Naide]   - Other parts: ${otherPartCount}`);

    // If there are no tool calls, we're done
    if (toolCalls.length === 0) {
      console.log(`[Naide] ✓ No tool calls in this round - conversation complete`);
      break;
    }

    console.log(`[Naide] Processing ${toolCalls.length} tool call(s)...`);

    // Add assistant message with tool calls to conversation
    conversationMessages.push(
      vscode.LanguageModelChatMessage.Assistant(toolCalls)
    );
    console.log(`[Naide] Added assistant message with ${toolCalls.length} tool calls`);

    // Invoke each tool and collect results
    const toolResults: vscode.LanguageModelToolResultPart[] = [];
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      try {
        console.log(`[Naide] [${i + 1}/${toolCalls.length}] Invoking tool: ${toolCall.name}`);
        console.log(`[Naide]   Call ID: ${toolCall.callId}`);
        console.log(`[Naide]   Input: ${JSON.stringify(toolCall.input)}`);
        stream.progress(`Executing ${toolCall.name}...`);
        
        const toolResult = await vscode.lm.invokeTool(
          toolCall.name,
          {
            input: toolCall.input,
            toolInvocationToken: request.toolInvocationToken
          },
          token
        );

        console.log(`[Naide]   Tool invocation completed, processing result...`);

        // Collect the tool result content
        const resultContent: string[] = [];
        for await (const contentPart of toolResult.content) {
          if (contentPart instanceof vscode.LanguageModelTextPart) {
            resultContent.push(contentPart.value);
            console.log(`[Naide]     Result content: ${contentPart.value.substring(0, 100)}`);
          }
        }

        toolResults.push(
          new vscode.LanguageModelToolResultPart(
            toolCall.callId,
            resultContent.map(content => new vscode.LanguageModelTextPart(content))
          )
        );

        console.log(`[Naide]   ✓ Tool ${toolCall.name} completed successfully`);
        console.log(`[Naide]     Result parts: ${resultContent.length}`);
      } catch (error) {
        console.error(`[Naide]   ✗ Error invoking tool ${toolCall.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`[Naide]     Error message: ${errorMessage}`);
        if (errorStack) {
          console.error(`[Naide]     Stack trace: ${errorStack}`);
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

    console.log(`[Naide] Added user message with ${toolResults.length} tool results`);
    console.log(`[Naide] Continuing to next round...`);
  }

  if (round >= maxRounds) {
    console.warn(`[Naide] ⚠ Reached maximum rounds (${maxRounds}), stopping conversation loop`);
    stream.markdown('\n\n*Note: Reached maximum tool invocation rounds.*');
  } else {
    console.log(`[Naide] Conversation ended naturally after ${round} rounds`);
  }
  console.log('[Naide] --- Language model conversation handler complete ---');
}
