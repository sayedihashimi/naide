import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

/**
 * Component to render message content with markdown support.
 * Both user and assistant messages support markdown formatting.
 */
const MessageContent: React.FC<MessageContentProps> = ({ content, role }) => {
  const textColor = role === 'assistant' ? 'text-gray-100' : 'text-white';

  const components: Components = {
    // Customize link styling
    a: ({ node, ...props }) => (
      <a
        {...props}
        className="text-blue-400 hover:text-blue-300 underline"
        target="_blank"
        rel="noopener noreferrer"
      />
    ),
    // Customize code block styling
    code: ({ node, inline, className, children, ...props }: any) => {
      if (inline) {
        return (
          <code
            {...props}
            className="bg-zinc-800 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono"
          >
            {children}
          </code>
        );
      }
      return (
        <code
          {...props}
          className="block bg-zinc-800 p-3 rounded text-sm font-mono overflow-x-auto"
        >
          {children}
        </code>
      );
    },
    // Customize pre styling for code blocks
    pre: ({ node, ...props }) => (
      <pre {...props} className="bg-zinc-800 p-3 rounded overflow-x-auto" />
    ),
    // Customize list styling
    ul: ({ node, ...props }) => (
      <ul {...props} className="list-disc list-inside space-y-1" />
    ),
    ol: ({ node, ...props }) => (
      <ol {...props} className="list-decimal list-inside space-y-1" />
    ),
    // Customize heading styling
    h1: ({ node, ...props }) => (
      <h1 {...props} className="text-2xl font-bold mt-4 mb-2" />
    ),
    h2: ({ node, ...props }) => (
      <h2 {...props} className="text-xl font-bold mt-3 mb-2" />
    ),
    h3: ({ node, ...props }) => (
      <h3 {...props} className="text-lg font-bold mt-2 mb-1" />
    ),
    // Customize paragraph styling
    p: ({ node, ...props }) => (
      <p {...props} className="mb-2 last:mb-0" />
    ),
    // Customize blockquote styling
    blockquote: ({ node, ...props }) => (
      <blockquote
        {...props}
        className="border-l-4 border-zinc-600 pl-4 italic my-2"
      />
    ),
  };

  return (
    <div className={`prose prose-invert max-w-none ${textColor}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default MessageContent;
