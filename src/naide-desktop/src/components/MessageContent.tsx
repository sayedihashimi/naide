import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { invoke } from '@tauri-apps/api/core';
import { useProjectLinkContext } from '../context/ProjectLinkContext';
import { extractProjectFilePath } from '../utils/projectLinkUtils';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
}

interface LinkTooltipState {
  message: string;
  x: number;
  y: number;
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

/**
 * Component to render message content with markdown support.
 * Both user and assistant messages support markdown formatting.
 */
const MessageContent: React.FC<MessageContentProps> = ({ content, role }) => {
  const textColor = role === 'assistant' ? 'text-gray-100' : 'text-white';
  const { projectPath, projectLinkDomains, currentFilePath, onOpenProjectFile } = useProjectLinkContext();
  const [linkTooltip, setLinkTooltip] = useState<LinkTooltipState | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to show tooltip with auto-dismiss
  const showTooltip = useCallback((message: string, x: number, y: number) => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    
    setLinkTooltip({ message, x, y });
    
    // Auto-dismiss after 3 seconds
    tooltipTimeoutRef.current = setTimeout(() => {
      setLinkTooltip(null);
      tooltipTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Create components with link interception
  const components = useMemo((): Components => ({
    // Customize link styling with project file interception
    a: ({ href, children, ...props }) => {
      // Validate href for security
      const safeHref = isValidHref(href) ? href : undefined;

      const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!href || !projectPath) return;

        const projectFilePath = extractProjectFilePath(href, projectLinkDomains, currentFilePath);
        if (!projectFilePath) return; // Not a project link, let default behavior happen

        e.preventDefault(); // Prevent browser navigation

        try {
          // Check if file exists
          const exists = await invoke<boolean>('check_file_exists', {
            projectPath,
            relativePath: projectFilePath,
          });

          if (exists) {
            onOpenProjectFile(projectFilePath);
          } else {
            // Show tooltip error
            const rect = e.currentTarget.getBoundingClientRect();
            showTooltip(`File not found: ${projectFilePath}`, rect.left, rect.bottom + 4);
          }
        } catch (error) {
          console.error('Error checking file existence:', error);
          // Show tooltip error
          const rect = e.currentTarget.getBoundingClientRect();
          showTooltip(`Unable to verify file: ${projectFilePath}`, rect.left, rect.bottom + 4);
        }
      };

      return (
        <a
          {...props}
          href={safeHref}
          className="text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
        >
          {children}
        </a>
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
  }), [projectPath, projectLinkDomains, currentFilePath, onOpenProjectFile, showTooltip]);

  return (
    <>
      <div className={`${textColor} max-w-none`}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {content}
        </Markdown>
      </div>
      {linkTooltip && (
        <div
          className="fixed bg-red-900 text-red-200 text-sm px-3 py-1.5 rounded shadow-lg z-50"
          style={{
            left: `${linkTooltip.x}px`,
            top: `${linkTooltip.y}px`,
          }}
        >
          {linkTooltip.message}
        </div>
      )}
    </>
  );
};

export default MessageContent;
