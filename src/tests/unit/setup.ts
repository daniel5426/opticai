import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock api-client
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    request: vi.fn(),
    login: vi.fn(),
    getUsers: vi.fn(() => Promise.resolve([])),
    getClients: vi.fn(() => Promise.resolve([])),
  },
}));

// Mock UserContext
vi.mock("@/contexts/UserContext", () => ({
  useUser: vi.fn(() => ({
    currentUser: {
      id: 1,
      username: "testuser",
      role: "clinic_worker",
      clinic_id: 1,
    },
    currentClinic: {
      id: 1,
      name: "Test Clinic",
      unique_id: "test-clinic",
    },
    authState: "AUTHENTICATED",
    isLoading: false,
    setCurrentUser: vi.fn(),
    setCurrentClinic: vi.fn(),
    logout: vi.fn(),
    logoutUser: vi.fn(),
    logoutClinic: vi.fn(),
    refreshClinics: vi.fn(),
    clinicRefreshTrigger: 0,
  })),
  UserProvider: ({ children }: { children: React.ReactNode }) => children,
}));
