import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Helper function to validate href for security
const isValidHref = (href?: string): boolean => {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    // If URL parsing fails, assume it's a relative URL which is safe
    return true;
  }
};

// Define components outside the component to avoid recreating on every render
const createComponents = (): Components => ({
  // Customize link styling
  a: ({ href, ...props }) => {
    // Validate href for security
    const safeHref = isValidHref(href) ? href : undefined;
    return (
      <a
        {...props}
        href={safeHref}
        className="text-blue-400 hover:text-blue-300 underline"
        target="_blank"
        rel="noopener noreferrer"
      />
    );
  },
  // Customize code block styling
  code: ({ className, children, ...props }: CodeProps) => {
    // In react-markdown, inline code doesn't have a className, while code blocks do (e.g., "language-javascript")
    // Also check if the parent is a <pre> tag (code blocks are wrapped in <pre>)
    const isInline = !className || !className.startsWith('language-');
    
    if (isInline) {
      return (
        <code
          className={`bg-zinc-800 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono ${className || ''}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={`text-sm font-mono ${className || ''}`}
        {...props}
      >
        {children}
      </code>
    );
  },
  // Customize pre styling for code blocks (outer wrapper)
  pre: ({ ...props }) => (
    <pre className="bg-zinc-800 p-3 rounded overflow-x-auto my-2" {...props} />
  ),
  // Customize list styling
  ul: ({ ...props }) => (
    <ul className="list-disc list-inside space-y-1 my-2" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal list-inside space-y-1 my-2" {...props} />
  ),
  // Customize heading styling
  h1: ({ ...props }) => (
    <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />
  ),
  h2: ({ ...props }) => (
    <h2 className="text-xl font-bold mt-3 mb-2" {...props} />
  ),
  h3: ({ ...props }) => (
    <h3 className="text-lg font-bold mt-2 mb-1" {...props} />
  ),
  // Customize paragraph styling
  p: ({ ...props }) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  // Customize blockquote styling
  blockquote: ({ ...props }) => (
    <blockquote
      className="border-l-4 border-zinc-600 pl-4 italic my-2"
      {...props}
    />
  ),
});

const components = createComponents();

/**
 * Component to render message content with markdown support.
 * Both user and assistant messages support markdown formatting.
 */
const MessageContent: React.FC<MessageContentProps> = ({ content, role }) => {
  const textColor = role === 'assistant' ? 'text-gray-100' : 'text-white';

  return (
    <div className={`${textColor} max-w-none`}>
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
