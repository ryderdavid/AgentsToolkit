import { CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

type Status = 'success' | 'warning' | 'error' | 'info';

interface StatusBadgeProps {
  status: Status;
  text: string;
}

export function StatusBadge({ status, text }: StatusBadgeProps) {
  const styles = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };

  const icons = {
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle,
    info: Info,
  };

  const Icon = icons[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
      <Icon size={12} />
      {text}
    </span>
  );
}
