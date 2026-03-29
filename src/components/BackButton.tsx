import { useNavigate } from 'react-router-dom';

type BackButtonProps = {
  fallbackPath?: string;
  label?: string;
};

export function BackButton({ fallbackPath = '/', label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <button type="button" className="back-button" onClick={handleBack}>
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 16 16" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path 
          d="M10 12L6 8L10 4" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
