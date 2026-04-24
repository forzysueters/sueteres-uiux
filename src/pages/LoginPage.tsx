import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoginCredentials } from '../types/auth';

export const LoginPage = () => {
  const { login, isLoading, error } = useAuthStore();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [localError, setLocalError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Industrial Digital Twin
            </h1>
            <p className="text-gray-600 mt-2">Secure Authentication System</p>
          </div>

          {/* Error Messages */}
          {(error || localError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">
                {error || localError}
              </p>
            </div>
          )}

          {/* Demo Credentials Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 text-xs font-semibold mb-2">Demo Credentials:</p>
            <ul className="text-blue-800 text-xs space-y-1">
              <li><strong>Admin:</strong> admin@industrial.com</li>
              <li><strong>Engineer:</strong> engineer@industrial.com</li>
              <li><strong>Technician:</strong> technician@industrial.com</li>
              <li><strong>Password:</strong> password123</li>
            </ul>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={credentials.email}
                onChange={handleChange}
                placeholder="your@email.com"
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition duration-200 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-xs text-gray-600">
              🔒 Secure authentication system with JWT tokens and bcrypt password hashing
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-8 text-center text-white">
          <div className="inline-block bg-white bg-opacity-10 backdrop-blur-sm rounded-lg px-6 py-3 border border-white border-opacity-20">
            <p className="text-sm font-medium">🛡️ Production-Ready Security</p>
            <p className="text-xs text-gray-200 mt-1">
              httpOnly Cookies • JWT Tokens • bcrypt Hashing • RBAC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
