import { Modal } from './Modal';
import { Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'success' | 'error' | 'info';
}

export const AlertModal = ({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info'
}: AlertModalProps) => {
  const icons = {
    success: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
    error: <AlertTriangle className="w-8 h-8 text-red-400" />,
    info: <Info className="w-8 h-8 text-indigo-400" />
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center text-center">
        <div className={clsx(
          "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border",
          variant === 'success' ? "bg-emerald-500/10 border-emerald-500/20" :
          variant === 'error' ? "bg-red-500/10 border-red-500/20" :
          "bg-indigo-500/10 border-indigo-500/20"
        )}>
          {icons[variant]}
        </div>

        <p className="text-theme-secondary mb-8 leading-relaxed font-medium">
          {message}
        </p>

        <button
          onClick={onClose}
          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
};
