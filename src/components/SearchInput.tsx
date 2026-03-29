import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { listCourses } from '../lib/api';
import type { Course } from '../types/api';

type SearchInputProps = {
  placeholder: string;
  buttonLabel: string;
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  compact?: boolean;
  readOnly?: boolean;
  showSuggestions?: boolean;
};

type Suggestion = {
  code: string;
  name: string;
};

const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 8;

function mapCourseToSuggestion(course: Course): Suggestion {
  return {
    code: course.course_code,
    name: course.course_name,
  };
}

export function SearchInput({
  placeholder,
  buttonLabel,
  value,
  onChange,
  onSubmit,
  compact = false,
  readOnly = false,
  showSuggestions = true,
}: SearchInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await listCourses({ q: query, limit: MAX_SUGGESTIONS });
      const mapped = response.data.map(mapCourseToSuggestion);
      setSuggestions(mapped);
      setIsOpen(mapped.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showSuggestions || readOnly) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      void fetchSuggestions(value);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [value, showSuggestions, readOnly, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: Suggestion) => {
    onChange?.(suggestion.code);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
    
    // Auto-submit after selection
    setTimeout(() => {
      onSubmit?.();
    }, 50);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          event.preventDefault();
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsOpen(false);
    onSubmit?.();
  };

  const handleInputChange = (newValue: string) => {
    onChange?.(newValue);
  };

  const handleFocus = () => {
    if (suggestions.length > 0 && value.length >= 2) {
      setIsOpen(true);
    }
  };

  return (
    <div className="search-combo-wrapper" ref={containerRef}>
      <form 
        className={`search-combo ${compact ? 'search-combo--compact' : ''}`} 
        onSubmit={handleSubmit}
      >
        <input
          ref={inputRef}
          className="search-combo__input"
          type="text"
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        <button className="search-combo__button" type="submit">
          {buttonLabel}
        </button>
      </form>

      {showSuggestions && isOpen && suggestions.length > 0 && (
        <ul className="suggestions-dropdown" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.code}
              className={`suggestion-item ${index === highlightedIndex ? 'suggestion-item--highlighted' : ''}`}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              <span className="suggestion-code">{suggestion.code}</span>
              <span className="suggestion-name">{suggestion.name}</span>
            </li>
          ))}
        </ul>
      )}

      {showSuggestions && isLoading && value.length >= 2 && (
        <div className="suggestions-loading">
          <span>Searching...</span>
        </div>
      )}
    </div>
  );
}
