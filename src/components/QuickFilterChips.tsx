import type { QuickFilter } from '../data/mockData';

type QuickFilterChipsProps = {
  items: QuickFilter[];
};

export function QuickFilterChips({ items }: QuickFilterChipsProps) {
  return (
    <div className="chip-row" aria-label="Quick filters">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={`chip ${index === 0 ? 'chip--active' : ''}`}
          aria-pressed={index === 0}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
