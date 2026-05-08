import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

interface PopoverProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

const Popover = ({ trigger, title, description, children, align = 'center' }: PopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && 
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Position logic (fixed to viewport)
  const getPosition = () => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = 150; // approximate
    const spaceBelow = window.innerHeight - rect.bottom;
    
    let top = rect.bottom + 8;
    let isBottom = true;

    if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
      top = rect.top - popoverHeight - 8;
      isBottom = false;
    }

    let left = align === 'start' ? rect.left : align === 'end' ? rect.right - 280 : rect.left + rect.width / 2 - 140;
    
    // Ensure it doesn't go off screen horizontally
    left = Math.max(16, Math.min(left, window.innerWidth - 296));

    return { top, left, isBottom };
  };

  const pos = getPosition();

  return (
    <div className="relative inline-block w-full" ref={triggerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer w-full">
        {trigger}
      </div>

      {isOpen && createPortal(
        <div 
          ref={popoverRef}
          style={{ top: pos.top, left: pos.left }}
          className={clsx(
            "fixed z-[100] w-[280px] glass-card border-theme-border p-5 shadow-2xl animate-in fade-in zoom-in duration-200",
            "bg-theme-base/95 backdrop-blur-xl"
          )}
        >
          <div className="space-y-2 mb-4">
            <h4 className="font-bold text-theme-primary text-sm leading-none">{title}</h4>
            <p className="text-xs text-theme-muted leading-relaxed">
              {description}
            </p>
          </div>
          {children && (
            <div className="pt-3 border-t border-theme-border/50">
              {children}
            </div>
          )}
          
          {/* Arrow */}
          <div className={clsx(
            "absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-theme-base border-theme-border rotate-45",
            pos.isBottom ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-b border-r"
          )} />
        </div>,
        document.body
      )}
    </div>
  );
};

export default Popover;
