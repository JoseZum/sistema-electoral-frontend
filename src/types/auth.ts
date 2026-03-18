export interface User {
  studentId: string;
  carnet: string;
  fullName: string;
  email: string;
  role: string;
  sede: string;
  career: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
