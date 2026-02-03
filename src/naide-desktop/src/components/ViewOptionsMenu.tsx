import React, { useRef, useEffect } from 'react';
import type { ViewOptions } from '../utils/featureFiles';

interface ViewOptionsMenuProps {
  options: ViewOptions;
  onChange: (options: ViewOptions) => void;
  onClose: () => void;
}

const ViewOptionsMenu: React.FC<ViewOptionsMenuProps> = ({ options, onChange, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleToggle = (key: keyof ViewOptions) => {
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-64 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-10"
    >
      <div className="py-2">
        <label className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-700 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={options.show_bugs}
            onChange={() => handleToggle('show_bugs')}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Show bugs</span>
        </label>
        <label className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-700 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={options.show_removed}
            onChange={() => handleToggle('show_removed')}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Show removed features</span>
        </label>
        <label className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-700 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={options.show_raw}
            onChange={() => handleToggle('show_raw')}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Show raw filenames</span>
        </label>
      </div>
    </div>
  );
};

export default ViewOptionsMenu;
