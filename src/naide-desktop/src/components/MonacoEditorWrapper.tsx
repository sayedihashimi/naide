import React, { useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco to use the local bundle instead of CDN
loader.config({ monaco });

interface MonacoEditorWrapperProps {
  value: string;
  language: string;
  readOnly: boolean;
  onChange?: (value: string) => void;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

/**
 * Monaco Editor wrapper component with Naide dark theme and standard configuration
 */
const MonacoEditorWrapper: React.FC<MonacoEditorWrapperProps> = ({
  value,
  language,
  readOnly,
  onChange,
  onMount,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const themeConfigured = useRef(false);

  // Configure Naide dark theme
  const configureTheme = () => {
    if (themeConfigured.current) return;
    
    monaco.editor.defineTheme('naide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],       // Inherit all syntax highlighting from vs-dark
      colors: {
        'editor.background': '#18181b',          // zinc-900
        'editor.foreground': '#f4f4f5',          // zinc-100
        'editorLineNumber.foreground': '#71717a', // zinc-500
        'editorLineNumber.activeForeground': '#a1a1aa', // zinc-400
        'editor.selectionBackground': '#3f3f46',  // zinc-700
        'editor.lineHighlightBackground': '#27272a', // zinc-800
        'editorCursor.foreground': '#3b82f6',     // blue-500
        'editorWidget.background': '#27272a',     // zinc-800
        'editorWidget.border': '#3f3f46',         // zinc-700
        'input.background': '#27272a',            // zinc-800
        'input.border': '#3f3f46',                // zinc-700
        'dropdown.background': '#27272a',         // zinc-800
        'dropdown.border': '#3f3f46',             // zinc-700
      },
    });
    
    themeConfigured.current = true;
  };

  const handleEditorMount: OnMount = (editor) => {
    configureTheme();
    monaco.editor.setTheme('naide-dark');
    editorRef.current = editor;
    
    if (onMount) {
      onMount(editor);
    }
  };

  // Update read-only state when it changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    readOnly,
    minimap: { enabled: false },
    lineNumbers: 'on',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,    // Auto-resize when container changes
    tabSize: 2,
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  };

  const loadingPlaceholder = (
    <div className="flex items-center justify-center h-full bg-zinc-900 text-gray-400">
      <div className="flex items-center gap-2">
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Loading editor...</span>
      </div>
    </div>
  );

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={(value) => onChange?.(value || '')}
      onMount={handleEditorMount}
      options={editorOptions}
      theme="naide-dark"
      loading={loadingPlaceholder}
    />
  );
};

export default MonacoEditorWrapper;
