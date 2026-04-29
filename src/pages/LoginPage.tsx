import { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { LoginCredentials } from '../types/auth';

export const LoginPage = () => {
  const { login, isLoading, error } = useAuthStore();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });  const [localError, setLocalError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validation
    if (!credentials.email || !credentials.password) {
      setLocalError('Please enter both email and password');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (credentials.password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    try {
      await login(credentials);
      // Redirect will happen in App.tsx based on auth state
    } catch (err: any) {
      setLocalError(err.message || 'Login failed. Please try again.');
    }
  };

  const demoCredentials = [
    { role: 'Admin', email: 'admin@industrial.com', password: 'password123' },
    { role: 'Engineer', email: 'engineer@industrial.com', password: 'password123' },
    { role: 'Technician', email: 'technician@industrial.com', password: 'password123' },
  ];

  const handleDemoLogin = (email: string) => {
    setCredentials({ email, password: 'password123' });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 opacity-50"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Main Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-8">          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <img 
                src="/src/static/logo-forzy-branca.svg" 
                alt="Forzy Logo" 
                className="h-16 w-auto drop-shadow-lg"
              />
            </div>
          </div>

          {/* Error Messages */}
          {(error || localError) && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">
                {error || localError}
              </p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5 mb-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={credentials.email}
                  onChange={handleChange}
                  placeholder="admin@industrial.com"
                  disabled={isLoading}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={credentials.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Credentials Toggle */}
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="w-full text-center text-slate-400 hover:text-slate-300 text-xs font-medium transition-colors py-2 border-t border-slate-700/50"
          >
            {showDemo ? '▼ Hide Demo Credentials' : '▶ Show Demo Credentials'}
          </button>

          {/* Demo Credentials Info */}
          {showDemo && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3">
              <p className="text-blue-300 text-xs font-semibold">Test with any credentials:</p>
              <div className="space-y-2">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.email}
                    onClick={() => handleDemoLogin(cred.email)}
                    type="button"
                    className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-300 text-sm font-medium group-hover:text-blue-300 transition-colors">
                          {cred.role}
                        </p>
                        <p className="text-slate-500 text-xs">{cred.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-xs">Password:</p>
                        <p className="text-slate-400 text-xs font-mono">{cred.password}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Security Info Footer */}
          </div>
        </div>
  );
};
