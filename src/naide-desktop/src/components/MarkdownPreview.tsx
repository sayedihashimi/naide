import React from 'react';
import MessageContent from './MessageContent';

interface MarkdownPreviewProps {
  content: string | null;
  fileName: string | null;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, fileName }) => {
  if (!content || !fileName) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Select a feature file to view
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto p-4 bg-zinc-900">
      <div className="mb-3 pb-2 border-b border-zinc-700">
        <h3 className="text-sm font-medium text-gray-300">{fileName}</h3>
      </div>
      <div className="prose prose-invert prose-sm max-w-none">
        <MessageContent content={content} role="assistant" />
      </div>
    </div>
  );
};

export default MarkdownPreview;
