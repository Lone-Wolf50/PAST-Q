import { Modal } from './Modal';
import { AlertCircle, Trash2, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmModalProps) => {
  const icons = {
    danger: <Trash2 className="w-6 h-6 text-red-400" />,
    warning: <AlertCircle className="w-6 h-6 text-amber-400" />,
    info: <HelpCircle className="w-6 h-6 text-indigo-400" />
  };

  const buttonStyles = {
    danger: "bg-red-500 hover:bg-red-600 shadow-red-500/20",
    warning: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20",
    info: "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20"
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center text-center">
        <div className={clsx(
          "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border",
          variant === 'danger' ? "bg-red-500/10 border-red-500/20" :
          variant === 'warning' ? "bg-amber-500/10 border-amber-500/20" :
          "bg-indigo-500/10 border-indigo-500/20"
        )}>
          {icons[variant]}
        </div>

        <p className="text-theme-secondary mb-8 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-3 rounded-2xl font-bold text-theme-muted bg-theme-surface-2 border border-theme-border hover:bg-theme-surface hover:text-theme-primary transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); }}
            disabled={isLoading}
            className={clsx(
              "flex-1 px-6 py-3 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50",
              buttonStyles[variant]
            )}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
