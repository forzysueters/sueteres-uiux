import { useAuthStore } from '../store/authStore';
import { LogOut, User, Shield } from 'lucide-react';

export const UserProfile = () => {
  const { user, logout, isLoading } = useAuthStore();

  if (!user) return null;

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      engineer: 'bg-blue-100 text-blue-800',
      technician: 'bg-green-100 text-green-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-gray-600" />
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-500" />
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getRoleBadgeColor(user.role)}`}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
        </div>
      </div>
      
      <button
        onClick={logout}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition duration-200 disabled:cursor-not-allowed"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </div>
  );
};
