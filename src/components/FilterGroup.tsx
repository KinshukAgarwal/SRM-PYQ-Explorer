import type { FilterOption } from '../data/mockData';

type FilterGroupProps = {
  title: string;
  options: FilterOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export function FilterGroup({ title, options, selectedIds, onToggle }: FilterGroupProps) {
  const isEmpty = options.length === 0;

  return (
    <section className="filter-group">
      <h3>{title}</h3>
      {isEmpty ? (
        <div className="filter-group__empty">
          <span className="filter-empty-icon">○</span>
          <span>No {title.toLowerCase()} available</span>
        </div>
      ) : (
        <div className="filter-group__list">
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            return (
              <label key={option.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                  aria-label={option.label}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
