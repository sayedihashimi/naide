import React from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { getFileIcon, getFileIconColor, type ProjectFileNode } from '../utils/projectFiles';

interface ProjectFilesListProps {
  files: ProjectFileNode[];
  expandedFolders: Set<string>;
  loadingFolders: Set<string>;
  onFolderToggle: (folderPath: string) => void;
  onFileClick?: (file: ProjectFileNode) => void;
  depth?: number;
}

const ProjectFilesList: React.FC<ProjectFilesListProps> = ({
  files,
  expandedFolders,
  loadingFolders,
  onFolderToggle,
  onFileClick,
  depth = 0,
}) => {
  const renderNode = (node: ProjectFileNode) => {
    const isExpanded = expandedFolders.has(node.path);
    const isLoading = loadingFolders.has(node.path);
    const Icon = getFileIcon(node.file_extension, node.is_folder, isExpanded);
    const iconColor = node.is_folder ? 'text-blue-400' : getFileIconColor(node.file_extension);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-zinc-800 transition-colors ${
            !node.is_folder ? 'hover:text-gray-200' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.is_folder) {
              onFolderToggle(node.path);
            } else if (onFileClick) {
              onFileClick(node);
            }
          }}
        >
          {node.is_folder && (
            <span className="flex-shrink-0 text-gray-400">
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          )}
          {!node.is_folder && <span className="w-3.5" />}
          <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
          <span className="text-sm text-gray-300 truncate">{node.name}</span>
        </div>
      </div>
    );
  };

  if (files.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic px-2 py-2" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
        (empty)
      </div>
    );
  }

  return (
    <div>
      {files.map((node) => renderNode(node))}
    </div>
  );
};

export default ProjectFilesList;
