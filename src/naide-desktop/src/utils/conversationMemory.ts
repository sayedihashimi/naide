/**
 * Conversation Memory Module
 * 
 * Implements the three-layer memory model:
 * 1. Short-Term: Rolling buffer of recent messages (6-10 messages)
 * 2. Mid-Term: Conversation summary (decisions, constraints, open questions)
 * 3. Long-Term: Repo files (.prompts/**)
 * 
 * This module handles short-term and mid-term memory.
 * Long-term memory is handled via file system operations.
 */

import type { ChatMessage } from './chatPersistence';

/**
 * Configuration for conversation memory
 */
export const MEMORY_CONFIG = {
  /** Maximum number of recent messages to include in short-term memory */
  MAX_RECENT_MESSAGES: 8,
  /** Minimum messages needed before generating a summary */
  MIN_MESSAGES_FOR_SUMMARY: 4,
  /** Maximum summary length in characters */
  MAX_SUMMARY_LENGTH: 2000,
} as const;

/**
 * Conversation summary structure for mid-term memory
 */
export interface ConversationSummary {
  /** Key decisions made during the conversation */
  decisions: string[];
  /** Active constraints or requirements */
  constraints: string[];
  /** Accepted defaults */
  acceptedDefaults: string[];
  /** Options explicitly rejected by the user */
  rejectedOptions: string[];
  /** Outstanding questions or unresolved topics */
  openQuestions: string[];
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Conversation context sent to the sidecar
 */
export interface ConversationContext {
  /** Rolling conversation summary (mid-term memory) */
  summary: ConversationSummary | null;
  /** Recent messages (short-term memory) */
  recentMessages: ChatMessage[];
  /** Total messages in the conversation */
  totalMessageCount: number;
}

/**
 * Creates an empty conversation summary
 */
export function createEmptyConversationSummary(): ConversationSummary {
  return {
    decisions: [],
    constraints: [],
    acceptedDefaults: [],
    rejectedOptions: [],
    openQuestions: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Extracts recent messages from the conversation (short-term memory)
 * 
 * @param messages - All messages in the conversation
 * @param maxMessages - Maximum number of messages to include (default: 8)
 * @returns The most recent messages
 */
export function getRecentMessages(
  messages: ChatMessage[],
  maxMessages: number = MEMORY_CONFIG.MAX_RECENT_MESSAGES
): ChatMessage[] {
  // Filter out welcome messages (they have IDs starting with 'welcome-')
  const nonWelcomeMessages = messages.filter(m => !m.id.startsWith('welcome-'));
  
  if (nonWelcomeMessages.length <= maxMessages) {
    return nonWelcomeMessages;
  }
  
  // Return the most recent messages
  return nonWelcomeMessages.slice(-maxMessages);
}

/**
 * Builds conversation context to send with Copilot requests
 * 
 * @param messages - All messages in the conversation
 * @param summary - Current conversation summary (can be null for new conversations)
 * @returns ConversationContext for the API request
 */
export function buildConversationContext(
  messages: ChatMessage[],
  summary: ConversationSummary | null
): ConversationContext {
  const recentMessages = getRecentMessages(messages);
  const nonWelcomeMessages = messages.filter(m => !m.id.startsWith('welcome-'));
  
  return {
    summary,
    recentMessages,
    totalMessageCount: nonWelcomeMessages.length,
  };
}

/**
 * Formats conversation summary as markdown for inclusion in prompts
 * 
 * @param summary - The conversation summary to format
 * @returns Formatted markdown string
 */
export function formatSummaryForPrompt(summary: ConversationSummary | null): string {
  if (!summary) {
    return '';
  }
  
  const sections: string[] = [];
  
  if (summary.decisions.length > 0) {
    sections.push(`### Key Decisions\n${summary.decisions.map(d => `- ${d}`).join('\n')}`);
  }
  
  if (summary.constraints.length > 0) {
    sections.push(`### Constraints\n${summary.constraints.map(c => `- ${c}`).join('\n')}`);
  }
  
  if (summary.acceptedDefaults.length > 0) {
    sections.push(`### Accepted Defaults\n${summary.acceptedDefaults.map(d => `- ${d}`).join('\n')}`);
  }
  
  if (summary.rejectedOptions.length > 0) {
    sections.push(`### Rejected Options\n${summary.rejectedOptions.map(r => `- ${r}`).join('\n')}`);
  }
  
  if (summary.openQuestions.length > 0) {
    sections.push(`### Open Questions\n${summary.openQuestions.map(q => `- ${q}`).join('\n')}`);
  }
  
  if (sections.length === 0) {
    return '';
  }
  
  return `## Conversation Summary\n\n${sections.join('\n\n')}`;
}

/**
 * Formats recent messages as markdown for inclusion in prompts
 * 
 * @param messages - Recent messages to format
 * @returns Formatted markdown string
 */
export function formatMessagesForPrompt(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return '';
  }
  
  const formattedMessages = messages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    return `**${role}**: ${m.content}`;
  });
  
  return `## Recent Conversation\n\n${formattedMessages.join('\n\n')}`;
}

/**
 * Checks if the conversation needs a summary update
 * 
 * @param totalMessages - Total number of messages in conversation
 * @param summary - Current summary (null if none exists)
 * @returns True if summary should be updated
 */
export function shouldUpdateSummary(
  totalMessages: number,
  summary: ConversationSummary | null
): boolean {
  // Don't create summary for very short conversations
  if (totalMessages < MEMORY_CONFIG.MIN_MESSAGES_FOR_SUMMARY) {
    return false;
  }
  
  // Create initial summary after minimum messages
  if (!summary) {
    return true;
  }
  
  // Update summary every 6 messages after initial creation
  // This triggers when totalMessages hits 10, 16, 22, etc.
  const updateInterval = 6;
  return (totalMessages - MEMORY_CONFIG.MIN_MESSAGES_FOR_SUMMARY) % updateInterval === 0;
}

/**
 * Merges a new summary update into an existing summary
 * 
 * @param existing - Existing summary (or null)
 * @param update - Partial update to merge
 * @returns Merged summary
 */
export function mergeSummary(
  existing: ConversationSummary | null,
  update: Partial<ConversationSummary>
): ConversationSummary {
  const base = existing || createEmptyConversationSummary();
  
  return {
    decisions: [...base.decisions, ...(update.decisions || [])],
    constraints: [...base.constraints, ...(update.constraints || [])],
    acceptedDefaults: [...base.acceptedDefaults, ...(update.acceptedDefaults || [])],
    rejectedOptions: [...base.rejectedOptions, ...(update.rejectedOptions || [])],
    openQuestions: update.openQuestions || base.openQuestions, // Replace open questions entirely
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parses a summary update from the AI response
 * This function looks for a structured summary block in the response
 * 
 * @param response - The AI response text
 * @returns Partial summary update if found, null otherwise
 */
export function parseSummaryFromResponse(response: string): Partial<ConversationSummary> | null {
  // Look for a structured summary block
  // The AI should format this as JSON within special markers
  const summaryMarkerStart = '<!-- CONVERSATION_SUMMARY_START -->';
  const summaryMarkerEnd = '<!-- CONVERSATION_SUMMARY_END -->';
  
  const startIdx = response.indexOf(summaryMarkerStart);
  const endIdx = response.indexOf(summaryMarkerEnd);
  
  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return null;
  }
  
  const summaryJson = response.substring(
    startIdx + summaryMarkerStart.length,
    endIdx
  ).trim();
  
  try {
    const parsed = JSON.parse(summaryJson);
    return {
      decisions: parsed.decisions || [],
      constraints: parsed.constraints || [],
      acceptedDefaults: parsed.acceptedDefaults || [],
      rejectedOptions: parsed.rejectedOptions || [],
      openQuestions: parsed.openQuestions || [],
    };
  } catch {
    console.warn('[ConversationMemory] Failed to parse summary from response');
    return null;
  }
}

/**
 * Removes the summary markers and AUTO_MODE markers from the AI response for display
 * 
 * @param response - The AI response text
 * @returns Response with markers removed
 */
export function cleanResponseForDisplay(response: string): string {
  let cleaned = response;
  
  // Remove CONVERSATION_SUMMARY block
  const summaryMarkerStart = '<!-- CONVERSATION_SUMMARY_START -->';
  const summaryMarkerEnd = '<!-- CONVERSATION_SUMMARY_END -->';
  
  const startIdx = cleaned.indexOf(summaryMarkerStart);
  const endIdx = cleaned.indexOf(summaryMarkerEnd);
  
  if (startIdx !== -1 && endIdx !== -1) {
    cleaned = (
      cleaned.substring(0, startIdx) +
      cleaned.substring(endIdx + summaryMarkerEnd.length)
    ).trim();
  }
  
  // Remove AUTO_MODE marker (used for mode selection indicator)
  cleaned = cleaned.replace(/<!-- AUTO_MODE: (planning|building) -->\n?/g, '');
  
  return cleaned;
}
