import type { KeyboardEvent } from 'react';
import type { ResultCardData } from '../data/mockData';

type ResultCardProps = {
  result: ResultCardData;
  onOpen?: () => void;
  onCourseCodeOpen?: () => void;
};

export function ResultCard({ result, onOpen, onCourseCodeOpen }: ResultCardProps) {
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen?.();
    }
  };

  return (
    <article
      className={`result-card ${onOpen ? 'result-card--interactive' : ''}`}
      onClick={onOpen}
      onKeyDown={handleCardKeyDown}
      tabIndex={onOpen ? 0 : -1}
      role={onOpen ? 'button' : undefined}
    >
      <div className="result-card__tag-row">
        <span className="result-tag">{result.tag}</span>
        {onCourseCodeOpen ? (
          <button
            type="button"
            className="result-code result-code--button"
            onClick={(event) => {
              event.stopPropagation();
              onCourseCodeOpen();
            }}
          >
            {result.courseCode}
          </button>
        ) : (
          <span className="result-code">{result.courseCode}</span>
        )}
      </div>
      <h3>{result.title}</h3>
      <p>{`${result.semester} | ${result.monthYear}`}</p>
      <p>{result.department}</p>
      {typeof result.papersCount === 'number' ? <p>{`${result.papersCount} papers available`}</p> : null}
      <button type="button" className="soft-button">
        View Papers
      </button>
    </article>
  );
}
