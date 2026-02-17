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
    // Determine mode from slash command
    const mode = getModeFromCommand(request.command);
    console.log(`[Naide] Processing request in ${mode} mode`);

    // Show progress
    stream.progress('Loading Naide context...');

    // Load system prompts and context
    stream.progress('Loading system prompts...');
    const systemPrompt = await loadSystemPrompts(extensionContext, mode);

    stream.progress('Loading project specifications...');
    const specs = await loadSpecFiles(workspaceRoot);

    stream.progress('Loading feature files...');
    const features = await loadFeatureFiles(workspaceRoot);

    // Assemble full instructions
    const instructions = [systemPrompt, specs, features].filter(Boolean).join('\n\n');

    console.log(`[Naide] Assembled instructions: ${instructions.length} characters`);

    // Reference the search_learnings tool so Copilot can use it
    const allTools = await vscode.lm.tools;
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
      console.log(`[Naide] Including ${context.history.length} previous turns in conversation`);
      
      // Convert chat history to language model messages
      for (const turn of context.history) {
        if (turn instanceof vscode.ChatRequestTurn) {
          // User message
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
            messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
          }
        }
      }
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
    
    console.log(`[Naide] Sending ${messages.length} messages to language model`);

    // Select language model
    stream.progress('Requesting language model...');
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });

    if (models.length === 0) {
      stream.markdown('❌ No language model available. Ensure GitHub Copilot is active.');
      return;
    }

    console.log(`[Naide] Using model: ${models[0].id}`);

    // Send request to language model
    stream.progress('Generating response...');
    const chatRequest = await models[0].sendRequest(
      messages,
      {
        justification: 'Naide provides spec-driven development assistance with project context',
        tools: learningsTool
      },
      token
    );

    // Stream the response
    let responseLength = 0;
    for await (const fragment of chatRequest.text) {
      stream.markdown(fragment);
      responseLength += fragment.length;
    }

    console.log(`[Naide] Response completed: ${responseLength} characters`);
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
