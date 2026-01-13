interface CharacterBudgetProps {
  current: number;
  max: number;
  label?: string;
}

export function CharacterBudget({ current, max, label = 'Usage' }: CharacterBudgetProps) {
  const percentage = (current / max) * 100;
  const colorClass = 
    percentage < 70 ? 'bg-green-500' :
    percentage < 90 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span>{current.toLocaleString()} / {max.toLocaleString()} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
