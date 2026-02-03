import React from 'react';
import MessageContent from './MessageContent';

interface MarkdownPreviewProps {
  content: string | null;
  fileName: string | null;
  onEdit?: () => void;
  canEdit?: boolean;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, fileName, onEdit, canEdit }) => {
  if (!content || !fileName) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Select a feature file to view
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto p-4 bg-zinc-900">
      <div className="mb-3 pb-2 border-b border-zinc-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">{fileName}</h3>
        {canEdit && onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-zinc-800 rounded transition-colors"
            title="Edit file"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="prose prose-invert prose-sm max-w-none">
        <MessageContent content={content} role="assistant" />
      </div>
    </div>
  );
};

export default MarkdownPreview;
