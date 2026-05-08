import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/hq-portal');
  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <h1 className="text-9xl font-bold text-theme-primary/5 tracking-tighter">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-400">Page Not Found</span>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-theme-primary mb-4">Wrong Path!</h2>
        <p className="text-theme-muted mb-8 max-w-md mx-auto">
          It looks like you've wandered into uncharted territory. You might need to sign in to access this page, or it may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link 
            to={isAdmin ? "/hq-portal" : "/login"}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <Home className="w-4 h-4" />
            {isAdmin ? "Return to Dashboard" : "Return to Login"}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

