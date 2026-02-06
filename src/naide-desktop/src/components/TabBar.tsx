import React, { useState, useRef, useEffect } from 'react';

export interface Tab {
  id: string;                    // Unique ID (e.g., file path or 'generate-app')
  type: 'chat' | 'feature-file';
  label: string;                 // Display name
  filePath?: string;             // For feature file tabs
  isPinned: boolean;             // false = temporary/preview
  isTemporary: boolean;          // true = italic, replaceable
  hasUnsavedChanges?: boolean;   // Show dot indicator
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCloseAll: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCloseAll,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleTabClick = (tabId: string) => {
    onTabSelect(tabId);
    setContextMenu(null);
  };

  const handleTabMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      const tab = tabs.find(t => t.id === tabId);
      if (tab && tab.type !== 'chat') { // Don't allow closing chat tab
        onTabClose(tabId);
      }
    }
  };

  const handleTabRightClick = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    const tab = tabs.find(t => t.id === tabId);
    
    // Don't show context menu for chat tab
    if (tab && tab.type === 'chat') {
      return;
    }
    
    setContextMenu({
      tabId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleCloseTab = (tabId: string) => {
    console.log('[TabBar] handleCloseTab called with tabId:', tabId);
    onTabClose(tabId);
    setContextMenu(null);
  };

  const handleCloseAll = () => {
    console.log('[TabBar] handleCloseAll called');
    onTabCloseAll();
    setContextMenu(null);
  };

  return (
    <div className="bg-zinc-800 border-b border-zinc-800">
      <div className="flex items-center overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isHovered = hoveredTabId === tab.id;
          const canClose = tab.type !== 'chat';

          return (
            <div
              key={tab.id}
              className={`
                relative flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors
                min-w-[120px] max-w-[200px] border-r border-zinc-700
                ${isActive 
                  ? 'bg-zinc-900 text-white border-b-2 border-b-blue-500' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }
              `}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleTabMiddleClick(e, tab.id)}
              onContextMenu={(e) => handleTabRightClick(e, tab.id)}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
              style={{ height: '36px' }}
            >
              {/* Tab label */}
              <span 
                className="flex-1 truncate text-sm"
                title={tab.label}
              >
                {tab.label}
              </span>

              {/* Unsaved changes indicator */}
              {tab.hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-blue-500" title="Unsaved changes" />
              )}

              {/* Close button */}
              {canClose && (isHovered || isActive) && (
                <button
                  onClick={(e) => {
                    console.log('[TabBar] Close button clicked for tab:', tab.id);
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Close tab"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded shadow-lg py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleCloseTab(contextMenu.tabId)}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCloseAll}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 transition-colors"
          >
            Close All
          </button>
        </div>
      )}
    </div>
  );
};

export default TabBar;
