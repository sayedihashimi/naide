import React, { useState, useEffect, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import MarkdownPreview from './MarkdownPreview';
import { readFeatureFile, writeFeatureFile } from '../utils/featureFiles';

interface FeatureFilePopupProps {
  filePath: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
}

const FeatureFilePopup: React.FC<FeatureFilePopupProps> = ({
  filePath,
  fileName,
  isOpen,
  onClose,
  projectPath,
}) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load file content when popup opens or file changes
  useEffect(() => {
    const loadContent = async () => {
      if (!isOpen || !filePath || !projectPath) {
        return;
      }

      try {
        setLoadError(null);
        const content = await readFeatureFile(projectPath, filePath);
        setFileContent(content);
        setEditedContent(content);
        setIsEditing(false);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('[FeatureFilePopup] Error reading file:', err);
        setLoadError('Failed to load file content');
        setFileContent(null);
      }
    };

    loadContent();
  }, [isOpen, filePath, projectPath]);

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
    if (!filePath || !projectPath) {
      return;
    }

    try {
      setIsSaving(true);
      await writeFeatureFile(projectPath, filePath, editedContent);
      setFileContent(editedContent);
      setHasUnsavedChanges(false);
      setIsEditing(false);
    } catch (err) {
      console.error('[FeatureFilePopup] Error saving file:', err);
      alert('Failed to save file: ' + err);
    } finally {
      setIsSaving(false);
    }
  }, [filePath, projectPath, editedContent]);

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

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
    }
    onClose();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditing && isOpen) {
        e.preventDefault();
        handleSave();
      }
    };

    if (isOpen && isEditing) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isEditing, handleSave]);

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={handleClose}
      title={fileName}
      initialWidth={800}
      initialHeight={600}
    >
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
          <textarea
            value={editedContent}
            onChange={handleContentChange}
            className="flex-1 p-4 bg-zinc-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
            placeholder="Enter markdown content..."
          />
        </div>
      ) : (
        <MarkdownPreview
          content={fileContent}
          fileName={fileName}
          onEdit={handleToggleEdit}
          canEdit={!!fileContent}
        />
      )}
    </DraggableModal>
  );
};

export default FeatureFilePopup;
