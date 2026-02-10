import { describe, it, expect } from 'vitest';
import {
  MEMORY_CONFIG,
  createEmptyConversationSummary,
  getRecentMessages,
  buildConversationContext,
  formatSummaryForPrompt,
  formatMessagesForPrompt,
  shouldUpdateSummary,
  mergeSummary,
  parseSummaryFromResponse,
  cleanResponseForDisplay,
  type ConversationSummary,
} from './conversationMemory';
import type { ChatMessage } from './chatPersistence';

// Helper to create test messages
const createMessage = (
  id: string,
  role: 'user' | 'assistant',
  content: string
): ChatMessage => ({
  id,
  role,
  content,
  timestamp: new Date().toISOString(),
});

describe('conversationMemory', () => {
  describe('MEMORY_CONFIG', () => {
    it('should have default configuration values', () => {
      expect(MEMORY_CONFIG.MAX_RECENT_MESSAGES).toBe(8);
      expect(MEMORY_CONFIG.MIN_MESSAGES_FOR_SUMMARY).toBe(4);
      expect(MEMORY_CONFIG.MAX_SUMMARY_LENGTH).toBe(2000);
    });
  });

  describe('createEmptyConversationSummary', () => {
    it('should create an empty summary with all arrays empty', () => {
      const summary = createEmptyConversationSummary();
      
      expect(summary.decisions).toEqual([]);
      expect(summary.constraints).toEqual([]);
      expect(summary.acceptedDefaults).toEqual([]);
      expect(summary.rejectedOptions).toEqual([]);
      expect(summary.openQuestions).toEqual([]);
      expect(summary.updatedAt).toBeDefined();
    });
  });

  describe('getRecentMessages', () => {
    it('should return all messages when count is below max', () => {
      const messages = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there'),
      ];
      
      const recent = getRecentMessages(messages);
      
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Hello');
      expect(recent[1].content).toBe('Hi there');
    });

    it('should return only the most recent messages when count exceeds max', () => {
      const messages = Array.from({ length: 12 }, (_, i) =>
        createMessage(`${i}`, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
      );
      
      const recent = getRecentMessages(messages, 8);
      
      expect(recent).toHaveLength(8);
      expect(recent[0].content).toBe('Message 4'); // First of last 8
      expect(recent[7].content).toBe('Message 11'); // Last message
    });

    it('should filter out welcome messages', () => {
      const messages = [
        createMessage('welcome-1', 'assistant', 'Welcome!'),
        createMessage('welcome-2', 'assistant', 'How can I help?'),
        createMessage('user-1', 'user', 'Hello'),
        createMessage('assistant-1', 'assistant', 'Hi there'),
      ];
      
      const recent = getRecentMessages(messages);
      
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Hello');
      expect(recent[1].content).toBe('Hi there');
    });

    it('should respect custom maxMessages parameter', () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createMessage(`${i}`, 'user', `Message ${i}`)
      );
      
      const recent = getRecentMessages(messages, 3);
      
      expect(recent).toHaveLength(3);
      expect(recent[0].content).toBe('Message 7');
      expect(recent[2].content).toBe('Message 9');
    });
  });

  describe('buildConversationContext', () => {
    it('should build context with summary and recent messages', () => {
      const messages = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi'),
      ];
      const summary: ConversationSummary = {
        decisions: ['Use React'],
        constraints: [],
        acceptedDefaults: [],
        rejectedOptions: [],
        openQuestions: [],
        updatedAt: new Date().toISOString(),
      };
      
      const context = buildConversationContext(messages, summary);
      
      expect(context.summary).toEqual(summary);
      expect(context.recentMessages).toHaveLength(2);
      expect(context.totalMessageCount).toBe(2);
    });

    it('should handle null summary', () => {
      const messages = [createMessage('1', 'user', 'Hello')];
      
      const context = buildConversationContext(messages, null);
      
      expect(context.summary).toBeNull();
      expect(context.totalMessageCount).toBe(1);
    });

    it('should exclude welcome messages from total count', () => {
      const messages = [
        createMessage('welcome-1', 'assistant', 'Welcome'),
        createMessage('1', 'user', 'Hello'),
      ];
      
      const context = buildConversationContext(messages, null);
      
      expect(context.totalMessageCount).toBe(1);
    });
  });

  describe('formatSummaryForPrompt', () => {
    it('should return empty string for null summary', () => {
      expect(formatSummaryForPrompt(null)).toBe('');
    });

    it('should return empty string for empty summary', () => {
      const summary = createEmptyConversationSummary();
      expect(formatSummaryForPrompt(summary)).toBe('');
    });

    it('should format summary with decisions', () => {
      const summary: ConversationSummary = {
        decisions: ['Use React', 'Use TypeScript'],
        constraints: [],
        acceptedDefaults: [],
        rejectedOptions: [],
        openQuestions: [],
        updatedAt: new Date().toISOString(),
      };
      
      const formatted = formatSummaryForPrompt(summary);
      
      expect(formatted).toContain('## Conversation Summary');
      expect(formatted).toContain('### Key Decisions');
      expect(formatted).toContain('- Use React');
      expect(formatted).toContain('- Use TypeScript');
    });

    it('should format all summary sections', () => {
      const summary: ConversationSummary = {
        decisions: ['Decision 1'],
        constraints: ['Constraint 1'],
        acceptedDefaults: ['Default 1'],
        rejectedOptions: ['Rejected 1'],
        openQuestions: ['Question 1'],
        updatedAt: new Date().toISOString(),
      };
      
      const formatted = formatSummaryForPrompt(summary);
      
      expect(formatted).toContain('### Key Decisions');
      expect(formatted).toContain('### Constraints');
      expect(formatted).toContain('### Accepted Defaults');
      expect(formatted).toContain('### Rejected Options');
      expect(formatted).toContain('### Open Questions');
    });
  });

  describe('formatMessagesForPrompt', () => {
    it('should return empty string for empty messages', () => {
      expect(formatMessagesForPrompt([])).toBe('');
    });

    it('should format messages with role labels', () => {
      const messages = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there'),
      ];
      
      const formatted = formatMessagesForPrompt(messages);
      
      expect(formatted).toContain('## Recent Conversation');
      expect(formatted).toContain('**User**: Hello');
      expect(formatted).toContain('**Assistant**: Hi there');
    });
  });

  describe('shouldUpdateSummary', () => {
    it('should return false for conversations below minimum', () => {
      expect(shouldUpdateSummary(2, null)).toBe(false);
      expect(shouldUpdateSummary(3, null)).toBe(false);
    });

    it('should return true at minimum message threshold with no summary', () => {
      expect(shouldUpdateSummary(4, null)).toBe(true);
    });

    it('should return true at update intervals', () => {
      const summary = createEmptyConversationSummary();
      // 4 + 6 = 10
      expect(shouldUpdateSummary(10, summary)).toBe(true);
      // 4 + 12 = 16
      expect(shouldUpdateSummary(16, summary)).toBe(true);
    });

    it('should return false between update intervals', () => {
      const summary = createEmptyConversationSummary();
      expect(shouldUpdateSummary(7, summary)).toBe(false);
      expect(shouldUpdateSummary(12, summary)).toBe(false);
    });
  });

  describe('mergeSummary', () => {
    it('should create new summary when existing is null', () => {
      const update = { decisions: ['New decision'] };
      
      const merged = mergeSummary(null, update);
      
      expect(merged.decisions).toEqual(['New decision']);
      expect(merged.constraints).toEqual([]);
    });

    it('should add to existing arrays', () => {
      const existing: ConversationSummary = {
        decisions: ['Decision 1'],
        constraints: ['Constraint 1'],
        acceptedDefaults: [],
        rejectedOptions: [],
        openQuestions: ['Question 1'],
        updatedAt: new Date().toISOString(),
      };
      const update = {
        decisions: ['Decision 2'],
        openQuestions: ['Question 2'], // This replaces
      };
      
      const merged = mergeSummary(existing, update);
      
      expect(merged.decisions).toEqual(['Decision 1', 'Decision 2']);
      expect(merged.constraints).toEqual(['Constraint 1']);
      expect(merged.openQuestions).toEqual(['Question 2']); // Replaced
    });

    it('should replace openQuestions instead of appending', () => {
      const existing: ConversationSummary = {
        decisions: [],
        constraints: [],
        acceptedDefaults: [],
        rejectedOptions: [],
        openQuestions: ['Old question'],
        updatedAt: new Date().toISOString(),
      };
      
      const merged = mergeSummary(existing, { openQuestions: ['New question'] });
      
      expect(merged.openQuestions).toEqual(['New question']);
    });
  });

  describe('parseSummaryFromResponse', () => {
    it('should return null when no markers present', () => {
      const response = 'Just a regular response without markers.';
      expect(parseSummaryFromResponse(response)).toBeNull();
    });

    it('should parse valid JSON between markers', () => {
      const response = `Here is my response.
<!-- CONVERSATION_SUMMARY_START -->
{
  "decisions": ["Use React"],
  "constraints": ["Must be fast"],
  "openQuestions": ["What about testing?"]
}
<!-- CONVERSATION_SUMMARY_END -->
More text here.`;
      
      const parsed = parseSummaryFromResponse(response);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.decisions).toEqual(['Use React']);
      expect(parsed?.constraints).toEqual(['Must be fast']);
      expect(parsed?.openQuestions).toEqual(['What about testing?']);
    });

    it('should return null for invalid JSON', () => {
      const response = `
<!-- CONVERSATION_SUMMARY_START -->
not valid json
<!-- CONVERSATION_SUMMARY_END -->`;
      
      expect(parseSummaryFromResponse(response)).toBeNull();
    });

    it('should handle partial summary data', () => {
      const response = `
<!-- CONVERSATION_SUMMARY_START -->
{"decisions": ["Only decisions"]}
<!-- CONVERSATION_SUMMARY_END -->`;
      
      const parsed = parseSummaryFromResponse(response);
      
      expect(parsed?.decisions).toEqual(['Only decisions']);
      expect(parsed?.constraints).toEqual([]);
    });
  });

  describe('cleanResponseForDisplay', () => {
    it('should return response unchanged when no markers', () => {
      const response = 'Just a regular response.';
      expect(cleanResponseForDisplay(response)).toBe(response);
    });

    it('should remove summary block from response', () => {
      const response = `Here is my response.
<!-- CONVERSATION_SUMMARY_START -->
{"decisions": ["Use React"]}
<!-- CONVERSATION_SUMMARY_END -->
More text here.`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).not.toContain('CONVERSATION_SUMMARY');
      expect(cleaned).toContain('Here is my response.');
      expect(cleaned).toContain('More text here.');
    });

    it('should handle markers at start of response', () => {
      const response = `<!-- CONVERSATION_SUMMARY_START -->
{"decisions": []}
<!-- CONVERSATION_SUMMARY_END -->
The actual response.`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).toBe('The actual response.');
    });

    it('should handle markers at end of response', () => {
      const response = `The actual response.
<!-- CONVERSATION_SUMMARY_START -->
{"decisions": []}
<!-- CONVERSATION_SUMMARY_END -->`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).toBe('The actual response.');
    });

    it('should remove AUTO_MODE planning marker', () => {
      const response = `<!-- AUTO_MODE: planning -->
I understand you want to plan a feature.`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).not.toContain('AUTO_MODE');
      expect(cleaned).not.toContain('<!--');
      expect(cleaned).toBe('I understand you want to plan a feature.');
    });

    it('should remove AUTO_MODE building marker', () => {
      const response = `<!-- AUTO_MODE: building -->
I will implement the feature.`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).not.toContain('AUTO_MODE');
      expect(cleaned).toBe('I will implement the feature.');
    });

    it('should remove AUTO_MODE marker in middle of response', () => {
      const response = `Here is some text.
<!-- AUTO_MODE: planning -->
More text after marker.`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).not.toContain('AUTO_MODE');
      expect(cleaned).toContain('Here is some text.');
      expect(cleaned).toContain('More text after marker.');
    });

    it('should handle both AUTO_MODE and CONVERSATION_SUMMARY markers', () => {
      const response = `<!-- AUTO_MODE: planning -->
Response text here.
<!-- CONVERSATION_SUMMARY_START -->
{"decisions": []}
<!-- CONVERSATION_SUMMARY_END -->
More text.`;
      
      const cleaned = cleanResponseForDisplay(response);
      
      expect(cleaned).not.toContain('AUTO_MODE');
      expect(cleaned).not.toContain('CONVERSATION_SUMMARY');
      expect(cleaned).toContain('Response text here.');
      expect(cleaned).toContain('More text.');
    });
  });
});
