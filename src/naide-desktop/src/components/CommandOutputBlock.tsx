import React, { useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface CommandOutputBlockProps {
  command: string;
  output: string;
  status: 'running' | 'success' | 'error';
  isExpanded: boolean;
  onToggle: () => void;
}

const CommandOutputBlock: React.FC<CommandOutputBlockProps> = ({
  command,
  output,
  status,
  isExpanded,
  onToggle,
}) => {
  const outputRef = useRef<HTMLPreElement>(null);
  const shouldAutoScroll = useRef(true);

  // Auto-scroll to bottom while running and output is being added
  useEffect(() => {
    if (status === 'running' && isExpanded && outputRef.current && shouldAutoScroll.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, status, isExpanded]);

  // Detect user scrolling to pause auto-scroll
  const handleScroll = () => {
    if (outputRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
      // If user scrolled up (not at bottom), pause auto-scroll
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
      shouldAutoScroll.current = isAtBottom;
    }
  };

  // Render status icon based on command status
  const renderStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-[18px] h-[18px] text-blue-400 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-[18px] h-[18px] text-green-400" />;
      case 'error':
        return <XCircle className="w-[18px] h-[18px] text-red-400" />;
    }
  };

  // Render chevron icon based on expanded state
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg my-2">
      {/* Header - always visible */}
      <div
        className="px-4 py-2 flex items-center cursor-pointer hover:bg-zinc-900 transition-colors"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <ChevronIcon className="w-4 h-4 text-zinc-400 mr-2 flex-shrink-0" />
        <span className="font-mono text-sm text-zinc-300 flex-1 truncate">
          $ {command}
        </span>
        <div className="ml-2 flex-shrink-0" aria-live="polite">
          {renderStatusIcon()}
        </div>
      </div>

      {/* Body - visible when expanded */}
      {isExpanded && (
        <div className="border-t border-zinc-800">
          {output ? (
            <pre
              ref={outputRef}
              className="px-4 py-2 max-h-[300px] overflow-y-auto font-mono text-xs text-zinc-400 whitespace-pre-wrap"
              onScroll={handleScroll}
            >
              {output}
            </pre>
          ) : (
            <div className="px-4 py-2 font-mono text-xs text-zinc-500 italic">
              (no output)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommandOutputBlock;
