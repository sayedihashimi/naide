import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/useAppContext';
import { listFeatureFiles, readFeatureFile, filterFeatureFiles, type FeatureFileNode } from '../utils/featureFiles';
import FeatureFilesList from './FeatureFilesList';
import MarkdownPreview from './MarkdownPreview';

const FeatureFilesViewer: React.FC = () => {
  const { state } = useAppContext();
  const [files, setFiles] = useState<FeatureFileNode[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FeatureFileNode[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FeatureFileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load feature files when project path changes
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
        const fileList = await listFeatureFiles(state.projectPath);
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
  }, [state.projectPath]);
  
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
        return;
      }
      
      try {
        const content = await readFeatureFile(state.projectPath, selectedFile.path);
        setFileContent(content);
      } catch (err) {
        console.error('[FeatureFilesViewer] Error reading file:', err);
        setFileContent('Error loading file content');
      }
    };
    
    loadContent();
  }, [selectedFile, state.projectPath]);
  
  const handleFileSelect = (node: FeatureFileNode) => {
    if (!node.is_folder) {
      setSelectedFile(node);
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Filter input */}
      <div className="p-3 border-b border-zinc-800">
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter features..."
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* File list */}
      <div className="flex-1 overflow-hidden border-b border-zinc-800">
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
      
      {/* Markdown preview */}
      <div className="h-64">
        <MarkdownPreview
          content={fileContent}
          fileName={selectedFile?.name || null}
        />
      </div>
    </div>
  );
};

export default FeatureFilesViewer;
