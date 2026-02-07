import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/useAppContext';
import { listProjectFiles, type ProjectFileNode } from '../utils/projectFiles';
import ProjectFilesList from './ProjectFilesList';

interface ProjectFilesViewerProps {
  onFileSelect?: (file: ProjectFileNode) => void;
}

// Hierarchical structure for rendering nested folders
interface FileTreeNode extends ProjectFileNode {
  children?: FileTreeNode[];
}

const ProjectFilesViewer: React.FC<ProjectFilesViewerProps> = ({ onFileSelect }) => {
  const { state } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [rootFiles, setRootFiles] = useState<ProjectFileNode[]>([]);
  const [loadedFolders, setLoadedFolders] = useState<Map<string, ProjectFileNode[]>>(new Map());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Load root files when expanded for the first time
  useEffect(() => {
    const loadRootFiles = async () => {
      if (!isExpanded || !state.projectPath || initialLoadDone) {
        return;
      }

      try {
        setError(null);
        const files = await listProjectFiles(state.projectPath);
        setRootFiles(files);
        setInitialLoadDone(true);
      } catch (err) {
        console.error('[ProjectFilesViewer] Error loading root files:', err);
        setError('Failed to load files');
      }
    };

    loadRootFiles();
  }, [isExpanded, state.projectPath, initialLoadDone]);

  // Reset when project changes
  useEffect(() => {
    setRootFiles([]);
    setLoadedFolders(new Map());
    setExpandedFolders(new Set());
    setLoadingFolders(new Set());
    setInitialLoadDone(false);
    setError(null);
  }, [state.projectPath]);

  // Handle folder toggle
  const handleFolderToggle = useCallback(async (folderPath: string) => {
    if (!state.projectPath) return;

    const isCurrentlyExpanded = expandedFolders.has(folderPath);

    if (isCurrentlyExpanded) {
      // Collapse the folder
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderPath);
        return next;
      });
    } else {
      // Expand the folder
      setExpandedFolders((prev) => new Set(prev).add(folderPath));

      // Load children if not already loaded
      if (!loadedFolders.has(folderPath)) {
        setLoadingFolders((prev) => new Set(prev).add(folderPath));

        try {
          const children = await listProjectFiles(state.projectPath, folderPath);
          setLoadedFolders((prev) => new Map(prev).set(folderPath, children));
        } catch (err) {
          console.error(`[ProjectFilesViewer] Error loading folder ${folderPath}:`, err);
          // Show error inline (future enhancement)
        } finally {
          setLoadingFolders((prev) => {
            const next = new Set(prev);
            next.delete(folderPath);
            return next;
          });
        }
      }
    }
  }, [state.projectPath, expandedFolders, loadedFolders]);

  // Build hierarchical tree from flat loaded data
  const fileTree = useMemo(() => {
    const buildTree = (nodes: ProjectFileNode[], parentPath: string = ''): FileTreeNode[] => {
      const result: FileTreeNode[] = [];

      for (const node of nodes) {
        const treeNode: FileTreeNode = { ...node };

        if (node.is_folder && expandedFolders.has(node.path)) {
          const children = loadedFolders.get(node.path);
          if (children) {
            treeNode.children = buildTree(children, node.path);
          }
        }

        result.push(treeNode);
      }

      return result;
    };

    return buildTree(rootFiles);
  }, [rootFiles, loadedFolders, expandedFolders]);

  // Filter tree based on query
  const filteredTree = useMemo(() => {
    if (!filterQuery.trim()) {
      return fileTree;
    }

    const query = filterQuery.toLowerCase();

    const filterNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      const filtered: FileTreeNode[] = [];

      for (const node of nodes) {
        const nameMatches = node.name.toLowerCase().includes(query);
        let childrenMatch: FileTreeNode[] = [];

        if (node.children) {
          childrenMatch = filterNodes(node.children);
        }

        if (nameMatches || childrenMatch.length > 0) {
          filtered.push({
            ...node,
            children: childrenMatch.length > 0 ? childrenMatch : node.children,
          });
        }
      }

      return filtered;
    };

    return filterNodes(fileTree);
  }, [fileTree, filterQuery]);

  // Flatten tree for rendering
  const flattenTree = (nodes: FileTreeNode[], depth: number = 0): Array<{ node: FileTreeNode; depth: number }> => {
    const result: Array<{ node: FileTreeNode; depth: number }> = [];

    for (const node of nodes) {
      result.push({ node, depth });

      if (node.is_folder && node.children && expandedFolders.has(node.path)) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }

    return result;
  };

  const flatTree = useMemo(() => flattenTree(filteredTree), [filteredTree, expandedFolders]);

  // Handle file click
  const handleFileClick = (file: ProjectFileNode) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
    // Future: open file in tab
  };

  return (
    <div className="flex flex-col">
      {/* Section Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Files</h2>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="flex flex-col overflow-hidden">
          {/* Filter Box */}
          <div className="px-4 pb-3">
            <input
              type="text"
              placeholder="Filter files..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* File Tree */}
          <div className="flex-1 overflow-y-auto px-2">
            {!state.projectPath ? (
              <div className="text-sm text-gray-500 italic px-2 py-2">Open a project to see files</div>
            ) : error ? (
              <div className="text-sm text-red-400 px-2 py-2">{error}</div>
            ) : flatTree.length === 0 && filterQuery ? (
              <div className="text-sm text-gray-500 italic px-2 py-2">No matching files</div>
            ) : flatTree.length === 0 && !initialLoadDone ? (
              <div className="text-sm text-gray-500 italic px-2 py-2">Loading...</div>
            ) : (
              flatTree.map(({ node, depth }) => (
                <div
                  key={node.path}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-zinc-800 transition-colors ${
                    !node.is_folder ? 'hover:text-gray-200' : ''
                  }`}
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                  onClick={() => {
                    if (node.is_folder) {
                      handleFolderToggle(node.path);
                    } else {
                      handleFileClick(node);
                    }
                  }}
                >
                  {node.is_folder && (
                    <span className="flex-shrink-0 text-gray-400">
                      {loadingFolders.has(node.path) ? (
                        <span className="w-3.5 h-3.5 inline-block">...</span>
                      ) : expandedFolders.has(node.path) ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  )}
                  {!node.is_folder && <span className="w-3.5" />}
                  <span
                    className={`w-4 h-4 flex-shrink-0 ${
                      node.is_folder ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  >
                    {node.is_folder ? '📁' : '📄'}
                  </span>
                  <span className="text-sm text-gray-300 truncate">{node.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectFilesViewer;
