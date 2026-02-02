import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    
    if (error) {
      setError(error.message);
    } else if (!isSignUp) {
      navigate('/dashboard');
    } else {
      setError('Check your email for confirmation link');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-md">
      <div className="w-full max-w-md">
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-lg shadow-card">
          <div className="flex items-center justify-center mb-xl">
            <Shield className="w-12 h-12 text-cyber-primary" />
          </div>
          <h1 className="text-h1 font-semibold text-text-main text-center mb-sm">
            SOC Dashboard
          </h1>
          <p className="text-small text-text-muted text-center mb-lg">
            LLM-Powered Autonomous Security Operations
          </p>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="block text-small text-text-muted mb-xs">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg-elevated border border-border-subtle rounded-md px-md py-sm text-body text-text-main font-mono focus:outline-none focus:border-cyber-primary focus:shadow-glow transition-all"
                placeholder="admin@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-small text-text-muted mb-xs">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-bg-elevated border border-border-subtle rounded-md px-md py-sm text-body text-text-main font-mono focus:outline-none focus:border-cyber-primary focus:shadow-glow transition-all pr-10"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-cyber-primary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-status-critical/10 border border-status-critical/30 rounded-md p-sm">
                <p className="text-small text-status-critical">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyber-primary text-bg-base font-semibold py-sm rounded-md hover:shadow-glow transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="text-small text-text-muted text-center mt-lg">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-cyber-primary hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
