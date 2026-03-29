import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { statItems, quickFilters } from '../data/mockData';

const popularSearches = [
  { code: '21CSC101T', name: 'Programming in C' },
  { code: '21CSC201J', name: 'Data Structures' },
  { code: '21MAB101T', name: 'Calculus & Linear Algebra' },
  { code: '21PHY101T', name: 'Engineering Physics' },
  { code: '21CSS101J', name: 'Python Programming' },
  { code: '21EEE101J', name: 'Basic Electrical Engineering' },
];

const features = [
  {
    title: 'All exam types',
    description: 'CAT-1, CAT-2, Semester End, Lab exams — everything in one place.',
    icon: '📚',
  },
  {
    title: 'Updated regularly',
    description: 'New papers added within days of exam completion.',
    icon: '⚡',
  },
  {
    title: 'Free forever',
    description: 'No sign-ups, no paywalls. Just open and study.',
    icon: '🎯',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    const normalizedQuery = query.trim();
    navigate(normalizedQuery ? `/results?q=${encodeURIComponent(normalizedQuery)}` : '/results');
  };

  const handleQuickSearch = (searchTerm: string) => {
    navigate(`/results?q=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <div className="landing-page">
      {/* Hero section with centered search */}
      <section className="landing-hero">
        <div className="hero-badge">
          <span>10,000+ papers</span>
          <span className="badge-separator">·</span>
          <span>45 departments</span>
        </div>
        
        <h1 className="hero-title">
          Find your question papers
        </h1>
        <p className="hero-subtitle">
          Search SRM's largest collection of previous year papers. Study smarter, not harder.
        </p>

        <div className="hero-search" aria-label="Search papers">
          <SearchInput
            placeholder="Search by course code or name — try '21CSC201J' or 'Data Structures'"
            buttonLabel="Search"
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
          />
        </div>

        <div className="quick-filters">
          <span className="quick-label">Popular:</span>
          {quickFilters.slice(0, 4).map((filter) => (
            <button
              key={filter.id}
              className="quick-chip"
              onClick={() => handleQuickSearch(filter.label)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* Stats row */}
      <section className="landing-stats" aria-label="Platform statistics">
        <div className="stats-grid stagger-children">
          {statItems.map((item) => (
            <StatCard key={item.label} value={item.value} label={item.label} highlighted={item.highlighted} />
          ))}
        </div>
      </section>

      {/* Popular searches section */}
      <section className="landing-popular">
        <div className="section-header">
          <h2>Popular courses</h2>
          <p>Jump straight to frequently searched subjects</p>
        </div>
        <div className="popular-grid">
          {popularSearches.map((course) => (
            <button
              key={course.code}
              className="popular-card"
              onClick={() => handleQuickSearch(course.code)}
              type="button"
            >
              <span className="popular-code">{course.code}</span>
              <span className="popular-name">{course.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Features section */}
      <section className="landing-features">
        <div className="features-grid">
          {features.map((feature) => (
            <div key={feature.title} className="feature-card">
              <span className="feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
      
      {/* Decorative ambient orbs */}
      <div className="landing-ambient" aria-hidden="true">
        <div className="ambient-orb ambient-orb--1"></div>
        <div className="ambient-orb ambient-orb--2"></div>
        <div className="ambient-orb ambient-orb--3"></div>
        <div className="ambient-grid"></div>
      </div>
    </div>
  );
}
