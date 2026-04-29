import bcrypt from 'bcryptjs';
import { User, UserRole } from '../types/index.js';

// In-memory database for demo. Replace with real DB (PostgreSQL, MongoDB, etc.)
let users: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@industrial.com',
    password: '', // Will be hashed in init
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Engineer User',
    email: 'engineer@industrial.com',
    password: '',
    role: 'engineer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Technician User',
    email: 'technician@industrial.com',
    password: '',
    role: 'technician',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Initialize with hashed passwords
export const initializeUsers = async () => {
  for (let user of users) {
    if (!user.password) {
      user.password = await bcrypt.hash('password123', 10);
    }
  }
};

// Call this at startup
initializeUsers().catch(console.error);

export const findUserByEmail = (email: string): User | undefined => {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

export const findUserById = (id: string): User | undefined => {
  return users.find(u => u.id === id);
};

export const validatePassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const createUser = async (
  name: string,
  email: string,
  plainPassword: string,
  role: UserRole = 'technician'
): Promise<User> => {
  const hashedPassword = await hashPassword(plainPassword);
  
  const newUser: User = {
    id: `user-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(newUser);
  return newUser;
};
