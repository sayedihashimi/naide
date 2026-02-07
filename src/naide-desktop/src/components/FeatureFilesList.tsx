import React, { useState } from 'react';
import type { FeatureFileNode } from '../utils/featureFiles';

interface FeatureFilesListProps {
  nodes: FeatureFileNode[];
  onFileSelect: (node: FeatureFileNode) => void;
  selectedPath: string | null;
}

interface FileTreeNodeProps {
  node: FeatureFileNode;
  onFileSelect: (node: FeatureFileNode) => void;
  selectedPath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  onFileSelect,
  selectedPath,
  expandedFolders,
  onToggleFolder,
}) => {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  
  if (node.is_folder) {
    return (
      <div className="select-none">
        <button
          onClick={() => onToggleFolder(node.path)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-zinc-800 rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <svg
            className="w-4 h-4 flex-shrink-0 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div className="ml-4 border-l border-zinc-700">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <button
      onDoubleClick={() => onFileSelect(node)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
        isSelected
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-zinc-800'
      }`}
    >
      <svg
        className="w-4 h-4 flex-shrink-0 ml-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span className="truncate">{node.name}</span>
    </button>
  );
};

const FeatureFilesList: React.FC<FeatureFilesListProps> = ({
  nodes,
  onFileSelect,
  selectedPath,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  
  if (nodes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No feature files found
      </div>
    );
  }
  
  return (
    <div className="overflow-y-auto">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          expandedFolders={expandedFolders}
          onToggleFolder={handleToggleFolder}
        />
      ))}
    </div>
  );
};

export default FeatureFilesList;
