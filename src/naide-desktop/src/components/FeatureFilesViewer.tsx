import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/useAppContext';
import { listFeatureFiles, filterFeatureFiles, type FeatureFileNode, type ViewOptions } from '../utils/featureFiles';
import FeatureFilesList from './FeatureFilesList';
import ViewOptionsMenu from './ViewOptionsMenu';

// LocalStorage keys for persisting view options
const STORAGE_KEY_VIEW_OPTIONS = 'naide-feature-viewer-options';

interface FeatureFilesViewerProps {
  onFileSelect?: (file: FeatureFileNode) => void;
  selectedPath?: string | null;
}

const FeatureFilesViewer: React.FC<FeatureFilesViewerProps> = ({ 
  onFileSelect, 
  selectedPath = null 
}) => {
  const { state } = useAppContext();
  const [files, setFiles] = useState<FeatureFileNode[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FeatureFileNode[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  // Load view options from localStorage
  const [viewOptions, setViewOptions] = useState<ViewOptions>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VIEW_OPTIONS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[FeatureFilesViewer] Error loading view options:', error);
    }
    return {
      show_bugs: false,
      show_removed: false,
      show_raw: false,
    };
  });
  
  // Save view options to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_OPTIONS, JSON.stringify(viewOptions));
    } catch (error) {
      console.error('[FeatureFilesViewer] Error saving view options:', error);
    }
  }, [viewOptions]);
  
  // Load feature files when project path or view options change
  useEffect(() => {
    const loadFiles = async () => {
      if (!state.projectPath) {
        setFiles([]);
        setFilteredFiles([]);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const fileList = await listFeatureFiles(state.projectPath, viewOptions);
        setFiles(fileList);
        setFilteredFiles(fileList);
      } catch (err) {
        console.error('[FeatureFilesViewer] Error loading files:', err);
        setError('Failed to load feature files');
        setFiles([]);
        setFilteredFiles([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadFiles();
  }, [state.projectPath, viewOptions]);
  
  // Apply filter when query or files change
  useEffect(() => {
    const filtered = filterFeatureFiles(files, filterQuery);
    setFilteredFiles(filtered);
  }, [files, filterQuery]);
  
  const handleFileSelect = (node: FeatureFileNode) => {
    if (!node.is_folder && onFileSelect) {
      onFileSelect(node);
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Filter input with gear icon */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter features..."
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-200 hover:bg-zinc-800 rounded transition-colors"
            title="View options"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          {showOptionsMenu && (
            <ViewOptionsMenu
              options={viewOptions}
              onChange={setViewOptions}
              onClose={() => setShowOptionsMenu(false)}
            />
          )}
        </div>
      </div>
      
      {/* File list - full vertical space */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading...
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400 text-sm">
            {error}
          </div>
        ) : !state.projectPath ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Open a project to view features
          </div>
        ) : (
          <FeatureFilesList
            nodes={filteredFiles}
            onFileSelect={handleFileSelect}
            selectedPath={selectedPath}
          />
        )}
      </div>
    </div>
  );
};

export default FeatureFilesViewer;
