import React, { useState, useEffect, useCallback } from 'react';
import MarkdownPreview from './MarkdownPreview';
import MonacoEditorWrapper from './MonacoEditorWrapper';
import { readFeatureFile, writeFeatureFile } from '../utils/featureFiles';

interface FeatureFileTabProps {
  filePath: string;
  fileName: string;
  projectPath: string;
  isActive: boolean;           // Whether this tab is currently displayed
  onContentChange: (hasChanges: boolean) => void; // Notify parent of unsaved changes
  onSave: () => void;          // Notify parent that file was saved (promotes to pinned)
  onStartEdit: () => void;     // Notify parent that edit started (promotes to pinned)
}

const FeatureFileTab: React.FC<FeatureFileTabProps> = ({
  filePath,
  fileName,
  projectPath,
  isActive,
  onContentChange,
  onSave,
  onStartEdit,
}) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load file content when tab becomes active (unless in edit mode)
  useEffect(() => {
    const loadContent = async () => {
      if (!isActive || !filePath || !projectPath || isEditing) {
        return;
      }

      try {
        setLoadError(null);
        const content = await readFeatureFile(projectPath, filePath);
        setFileContent(content);
        setEditedContent(content);
        // Don't reset hasUnsavedChanges here - it's managed separately
      } catch (err) {
        console.error('[FeatureFileTab] Error reading file:', err);
        console.error('[FeatureFileTab] Context:', { projectPath, filePath, isActive, isEditing });
        setLoadError('Failed to load file content');
        setFileContent(null);
      }
    };

    loadContent();
  }, [isActive, filePath, projectPath, isEditing]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onContentChange(hasUnsavedChanges);
    // Note: onContentChange excluded from deps to avoid infinite loop (parent recreates function every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges]);

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
      // Notify parent that edit started (will pin the tab)
      onStartEdit();
    }
  };

  const handleContentChange = (value: string) => {
    setEditedContent(value);
    const hasChanges = value !== fileContent;
    setHasUnsavedChanges(hasChanges);
  };

  const handleSave = useCallback(async () => {
    if (!filePath || !projectPath) {
      return;
    }

    try {
      setIsSaving(true);
      await writeFeatureFile(projectPath, filePath, editedContent);
      setFileContent(editedContent);
      setHasUnsavedChanges(false);
      setIsEditing(false);
      // Notify parent that file was saved (will pin the tab if temporary)
      onSave();
    } catch (err) {
      console.error('[FeatureFileTab] Error saving file:', err);
      alert('Failed to save file: ' + err);
    } finally {
      setIsSaving(false);
    }
  }, [filePath, projectPath, editedContent, onSave]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditing && isActive) {
        e.preventDefault();
        handleSave();
      }
      // ESC to cancel
      if (e.key === 'Escape' && isEditing && isActive) {
        e.preventDefault();
        handleCancel();
      }
    };

    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, isEditing, handleSave]);

  return (
    <div className="h-full w-full flex flex-col bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-800">
        <div className="text-sm text-gray-400 font-mono">
          .prompts/features/{fileName}
        </div>
        {!isEditing && (
          <button
            onClick={handleToggleEdit}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-zinc-700 rounded transition-colors"
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

      {/* Content area */}
      {loadError ? (
        <div className="h-full flex items-center justify-center text-red-400 text-sm p-4">
          {loadError}
        </div>
      ) : isEditing ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-900">
            <span className="text-sm font-medium text-gray-300">
              Editing
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
          <div className="flex-1 w-full">
            <MonacoEditorWrapper
              value={editedContent}
              language="markdown"
              readOnly={false}
              onChange={handleContentChange}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <MarkdownPreview
            content={fileContent}
            fileName={fileName}
            filePath={`.prompts/features/${filePath}`}
            onEdit={handleToggleEdit}
            canEdit={!!fileContent}
          />
        </div>
      )}
    </div>
  );
};

export default FeatureFileTab;
