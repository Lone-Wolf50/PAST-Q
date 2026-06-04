import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  hideHeader?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md', hideHeader = false }: ModalProps) => {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop - plain dark overlay, no backdrop-filter to avoid mobile stacking issues */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 z-0"
          />

          {/* Modal Content - explicit solid bg to avoid backdrop-filter conflicts on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={clsx(
              'relative z-10 w-full flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl',
              'border border-white/10',
              'max-h-[92vh] sm:max-h-[85vh]',
              maxWidth
            )}
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}
          >
            {/* Header */}
            {!hideHeader && (
              <div
                className="flex items-center justify-between px-5 py-4 border-b shrink-0 rounded-t-2xl sm:rounded-t-2xl"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}
              >
                <h3 className="text-base font-bold text-theme-primary tracking-tight">
                  {title || 'Notice'}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
                  style={{ background: 'var(--bg-surface)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Body - scrollable */}
            <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
