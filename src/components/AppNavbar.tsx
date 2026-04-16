import { Link } from 'react-router-dom';

export function AppNavbar() {
  return (
    <header className="top-navbar">
      <Link to="/" className="top-navbar__title">SRM PYQ</Link>
      <a
        href="https://srm-pyq-api.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="docs-button group"
      >
        <span className="docs-button__text">API Docs</span>
        <span className="docs-button__icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </a>
    </header>
  );
}
