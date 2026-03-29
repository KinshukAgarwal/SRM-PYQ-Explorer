import { Link } from 'react-router-dom';

export function AppNavbar() {
  return (
    <header className="top-navbar">
      <Link to="/" className="top-navbar__title">SRM PYQ</Link>
    </header>
  );
}
