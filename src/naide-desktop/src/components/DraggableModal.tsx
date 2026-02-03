import React, { useState, useRef, useEffect } from 'react';

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialWidth?: number;
  initialHeight?: number;
  children: React.ReactNode;
}

const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  initialWidth = 800,
  initialHeight = 600,
  children,
}) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle dragging
  const handleMouseDownTitle = (e: React.MouseEvent) => {
    // Only start drag if clicking on the title bar, not buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Handle resizing
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        setSize({
          width: Math.max(400, resizeStart.width + deltaX),
          height: Math.max(300, resizeStart.height + deltaY),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Prevent text selection during drag/resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isDragging ? 'move' : 'nwse-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-700 rounded-t-lg cursor-move"
          onMouseDown={handleMouseDownTitle}
        >
          <h2 className="text-sm font-medium text-gray-100 select-none">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-100 hover:bg-zinc-800 rounded transition-colors"
            title="Close"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={handleMouseDownResize}
        >
          <svg
            className="w-4 h-4 text-zinc-600"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M14 10l-4 4M14 6l-8 8M14 2L2 14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </>
  );
};

export default DraggableModal;
