type StatCardProps = {
  value: string;
  label: string;
  highlighted?: boolean;
};

export function StatCard({ value, label, highlighted = false }: StatCardProps) {
  return (
    <article className={`stat-card ${highlighted ? 'stat-card--highlight' : ''}`}>
      <h3>{value}</h3>
      <p>{label}</p>
    </article>
  );
}
