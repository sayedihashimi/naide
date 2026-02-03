import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/useAppContext';
import { listFeatureFiles, readFeatureFile, writeFeatureFile, filterFeatureFiles, type FeatureFileNode, type ViewOptions } from '../utils/featureFiles';
import FeatureFilesList from './FeatureFilesList';
import MarkdownPreview from './MarkdownPreview';
import ViewOptionsMenu from './ViewOptionsMenu';

// LocalStorage keys for persisting view options
const STORAGE_KEY_VIEW_OPTIONS = 'naide-feature-viewer-options';

const FeatureFilesViewer: React.FC = () => {
  const { state } = useAppContext();
  const [files, setFiles] = useState<FeatureFileNode[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FeatureFileNode[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FeatureFileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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
  
  // Load file content when selected file changes
  useEffect(() => {
    const loadContent = async () => {
      if (!selectedFile || !state.projectPath || selectedFile.is_folder) {
        setFileContent(null);
        setIsEditing(false);
        setHasUnsavedChanges(false);
        return;
      }
      
      try {
        const content = await readFeatureFile(state.projectPath, selectedFile.path);
        setFileContent(content);
        setEditedContent(content);
        setIsEditing(false);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('[FeatureFilesViewer] Error reading file:', err);
        setFileContent('Error loading file content');
      }
    };
    
    loadContent();
  }, [selectedFile, state.projectPath]);
  
  const handleFileSelect = (node: FeatureFileNode) => {
    // Warn if there are unsaved changes
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    
    if (!node.is_folder) {
      setSelectedFile(node);
    }
  };
  
  const handleToggleEdit = () => {
    if (isEditing) {
      // Warn if there are unsaved changes
      if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Do you want to discard them?')) {
          return;
        }
      }
      setIsEditing(false);
      setEditedContent(fileContent || '');
      setHasUnsavedChanges(false);
    } else {
      setIsEditing(true);
    }
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    setHasUnsavedChanges(e.target.value !== fileContent);
  };
  
  const handleSave = useCallback(async () => {
    if (!selectedFile || !state.projectPath) {
      return;
    }
    
    try {
      setIsSaving(true);
      await writeFeatureFile(state.projectPath, selectedFile.path, editedContent);
      setFileContent(editedContent);
      setHasUnsavedChanges(false);
      setIsEditing(false);
    } catch (err) {
      console.error('[FeatureFilesViewer] Error saving file:', err);
      alert('Failed to save file: ' + err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, state.projectPath, editedContent]);
  
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    setEditedContent(fileContent || '');
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditing) {
        e.preventDefault();
        handleSave();
      }
    };
    
    if (isEditing) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEditing, handleSave]);
  
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
      
      {/* File list - 30% of vertical space */}
      <div className="flex-[0.3] min-h-[200px] overflow-hidden border-b border-zinc-800">
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
            selectedPath={selectedFile?.path || null}
          />
        )}
      </div>
      
      {/* Markdown preview - 70% of vertical space */}
      <div className="flex-[0.7] min-h-0 flex flex-col">
        {isEditing ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
              <span className="text-sm font-medium text-gray-300">
                Editing: {selectedFile?.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm text-gray-300 hover:text-gray-100 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <textarea
              value={editedContent}
              onChange={handleContentChange}
              className="flex-1 p-4 bg-zinc-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
              placeholder="Enter markdown content..."
            />
          </>
        ) : (
          <MarkdownPreview
            content={fileContent}
            fileName={selectedFile?.name || null}
            onEdit={handleToggleEdit}
            canEdit={!!selectedFile && !!fileContent}
          />
        )}
      </div>
    </div>
  );
};

export default FeatureFilesViewer;
