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

interface BudgetBreakdownItem {
  label: string;
  chars: number;
  color: string;
}

interface CharacterBudgetWithBreakdownProps {
  max: number;
  breakdown: BudgetBreakdownItem[];
  label?: string;
}

export function CharacterBudgetWithBreakdown({ 
  max, 
  breakdown, 
  label = 'Budget Breakdown' 
}: CharacterBudgetWithBreakdownProps) {
  const total = breakdown.reduce((sum, item) => sum + item.chars, 0);
  const percentage = (total / max) * 100;
  const isOverLimit = total > max;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={isOverLimit ? 'text-red-600 font-medium' : 'text-slate-600'}>
          {total.toLocaleString()} / {max.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>

      {/* Stacked bar */}
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div className="flex h-full">
          {breakdown.map((item, index) => {
            const itemPercentage = (item.chars / max) * 100;
            return (
              <div
                key={index}
                className={`h-full transition-all ${item.color}`}
                style={{ width: `${Math.min(itemPercentage, 100 - breakdown.slice(0, index).reduce((s, i) => s + (i.chars / max) * 100, 0))}%` }}
                title={`${item.label}: ${item.chars.toLocaleString()} chars`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {breakdown.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${item.color}`} />
            <span className="text-slate-600">
              {item.label}: {item.chars.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {isOverLimit && (
        <p className="text-xs text-red-600">
          ⚠️ Budget exceeds limit by {(total - max).toLocaleString()} characters
        </p>
      )}
    </div>
  );
}
