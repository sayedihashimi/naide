import React from 'react';

interface AppInfo {
  app_type: string;
  project_file?: string;
  command?: string;
}

interface AppSelectorDropdownProps {
  apps: AppInfo[];
  selectedApp: {
    type?: 'dotnet' | 'npm';
    projectFile?: string;
  };
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (app: AppInfo) => void;
  buttonText?: string;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

const AppSelectorDropdown: React.FC<AppSelectorDropdownProps> = ({
  apps,
  selectedApp,
  isOpen,
  onToggle,
  onSelect,
  buttonText = 'Switch app',
  dropdownRef,
}) => {
  if (apps.length <= 1) {
    return null;
  }

  return (
    <div className="relative inline-block mt-3" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors flex items-center gap-1"
      >
        <span>{buttonText}</span>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-20 min-w-[280px] max-w-[400px]">
          {apps.map((app) => {
            const isSelected = app.app_type === selectedApp.type && app.project_file === selectedApp.projectFile;
            const displayName = app.project_file || 'root';
            const commandHint = app.command || (app.app_type === 'dotnet' ? 'dotnet watch' : '');
            const key = `${app.app_type}-${app.project_file || 'root'}`;
            
            return (
              <button
                key={key}
                onClick={() => onSelect(app)}
                className={`w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-b-0 first:rounded-t-lg last:rounded-b-lg ${
                  isSelected ? 'bg-zinc-700/50' : ''
                }`}
              >
                <div className={`font-medium text-sm ${isSelected ? 'text-blue-400' : 'text-zinc-200'}`}>
                  {displayName}
                  {isSelected && (
                    <svg className="inline w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {app.app_type}
                  {commandHint && ` • ${commandHint}`}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppSelectorDropdown;
