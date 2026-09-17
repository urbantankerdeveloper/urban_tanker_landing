import { Check, X } from 'lucide-react';

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <Check size={16} />
      <span>{message}</span>
      <button className="toast-close" type="button" aria-label="Close notification" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
