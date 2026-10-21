import { create } from 'zustand';
import { isSuperAdminRole, isSupervisorOrAdminRole, canAuthorizeOperations } from '@ero/shared';

export { isSuperAdminRole, isSupervisorOrAdminRole, canAuthorizeOperations };

export interface UserSession {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
  branchId?: string;
  warehouseId?: string;
  permissions: string[];
  branches?: string[];
  warehouses?: string[];
  allBranches?: boolean;
  canSwitchWarehouses?: boolean;
}

export interface TempAuthUser {
  userId: string;
  username: string;
  email: string;
  fullName?: string;
}

export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 horas máximo de sesión
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inactividad

export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (typeof parsed?.exp === 'number') {
      return parsed.exp * 1000; // a milisegundos
    }
    return null;
  } catch {
    return null;
  }
}

interface PersistedSession {
  user: UserSession | null;
  token: string | null;
  activeBranchId: string | null;
  activeWarehouseId: string | null;
  expiresAt: number | null;
  lastActivityAt: number | null;
}

interface AuthState {
  user: UserSession | null;
  token: string | null;
  activeBranchId: string | null;
  activeWarehouseId: string | null;
  isAuthenticated: boolean;
  requires2FA: boolean;
  tempUser: TempAuthUser | null;
  expiresAt: number | null;
  lastActivityAt: number | null;
  sessionExpiredReason: string | null;
  setAuth: (user: UserSession, token: string) => void;
  setRequires2FA: (tempUser: TempAuthUser) => void;
  clearTempUser: () => void;
  setActiveBranch: (branchId: string, warehouseId?: string) => void;
  setActiveWarehouse: (warehouseId: string) => void;
  hasPermission: (module: string, action: string) => boolean;
  recordActivity: () => void;
  checkSessionValidity: () => boolean;
  clearSessionExpiredReason: () => void;
  logout: (reason?: string) => void;
}

const STORAGE_KEY = 'ero_erp_auth_session';

const loadPersistedAuth = (): {
  user: UserSession | null;
  token: string | null;
  activeBranchId: string | null;
  activeWarehouseId: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  lastActivityAt: number | null;
  sessionExpiredReason: string | null;
} => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        user: null,
        token: null,
        activeBranchId: null,
        activeWarehouseId: null,
        isAuthenticated: false,
        expiresAt: null,
        lastActivityAt: null,
        sessionExpiredReason: null,
      };
    }
    const parsed: Partial<PersistedSession> = JSON.parse(raw);
    const now = Date.now();

    // Validar expiración de token JWT
    const jwtExp = parsed.token ? decodeJwtExp(parsed.token) : null;
    const isExpiredJwt = jwtExp !== null && now >= jwtExp;

    // Validar expiración absoluta (máximo 8 horas)
    const isExpiredAbsolute = parsed.expiresAt ? now >= parsed.expiresAt : false;

    // Validar inactividad (30 minutos sin interacción)
    const isExpiredInactivity = parsed.lastActivityAt
      ? now - parsed.lastActivityAt >= INACTIVITY_TIMEOUT_MS
      : false;

    if (isExpiredJwt || isExpiredAbsolute || isExpiredInactivity) {
      localStorage.removeItem(STORAGE_KEY);
      const reason = isExpiredInactivity
        ? 'Su sesión ha expirado por inactividad (30 minutos).'
        : isExpiredAbsolute
        ? 'Su sesión ha alcanzado el límite máximo de duración (8 horas).'
        : 'Su token de acceso ha expirado.';

      return {
        user: null,
        token: null,
        activeBranchId: null,
        activeWarehouseId: null,
        isAuthenticated: false,
        expiresAt: null,
        lastActivityAt: null,
        sessionExpiredReason: reason,
      };
    }

    return {
      user: parsed.user || null,
      token: parsed.token || null,
      activeBranchId: parsed.activeBranchId || parsed.user?.branchId || null,
      activeWarehouseId: parsed.activeWarehouseId || parsed.user?.warehouseId || null,
      isAuthenticated: Boolean(parsed.token && parsed.user),
      expiresAt: parsed.expiresAt || null,
      lastActivityAt: parsed.lastActivityAt || now,
      sessionExpiredReason: null,
    };
  } catch {
    return {
      user: null,
      token: null,
      activeBranchId: null,
      activeWarehouseId: null,
      isAuthenticated: false,
      expiresAt: null,
      lastActivityAt: null,
      sessionExpiredReason: null,
    };
  }
};

const initialSession = loadPersistedAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialSession.user,
  token: initialSession.token,
  activeBranchId: initialSession.activeBranchId,
  activeWarehouseId: initialSession.activeWarehouseId,
  isAuthenticated: initialSession.isAuthenticated,
  requires2FA: false,
  tempUser: null,
  expiresAt: initialSession.expiresAt,
  lastActivityAt: initialSession.lastActivityAt,
  sessionExpiredReason: initialSession.sessionExpiredReason,

  setAuth: (user, token) => {
    const branchId = user.branchId || null;
    const warehouseId = user.warehouseId || null;
    const now = Date.now();
    const jwtExp = decodeJwtExp(token);
    const expiresAt = jwtExp ? Math.min(now + SESSION_MAX_AGE_MS, jwtExp) : now + SESSION_MAX_AGE_MS;
    const lastActivityAt = now;

    const sessionData: PersistedSession = {
      user,
      token,
      activeBranchId: branchId,
      activeWarehouseId: warehouseId,
      expiresAt,
      lastActivityAt,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch {
      // Ignorar errores en almacenamiento local
    }

    set({
      user,
      token,
      activeBranchId: branchId,
      activeWarehouseId: warehouseId,
      isAuthenticated: true,
      requires2FA: false,
      tempUser: null,
      expiresAt,
      lastActivityAt,
      sessionExpiredReason: null,
    });
  },

  setRequires2FA: (tempUser) => {
    set({
      requires2FA: true,
      tempUser,
    });
  },

  clearTempUser: () => {
    set({
      requires2FA: false,
      tempUser: null,
    });
  },

  setActiveBranch: (branchId, warehouseId) => {
    const current = get();
    const updatedWarehouseId = warehouseId !== undefined ? warehouseId : current.activeWarehouseId;
    const sessionData: PersistedSession = {
      user: current.user,
      token: current.token,
      activeBranchId: branchId,
      activeWarehouseId: updatedWarehouseId,
      expiresAt: current.expiresAt,
      lastActivityAt: current.lastActivityAt,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch {
      // Ignorar errores
    }

    set({
      activeBranchId: branchId,
      ...(warehouseId !== undefined ? { activeWarehouseId: warehouseId } : {}),
    });
  },

  setActiveWarehouse: (warehouseId) => {
    const current = get();
    const sessionData: PersistedSession = {
      user: current.user,
      token: current.token,
      activeBranchId: current.activeBranchId,
      activeWarehouseId: warehouseId,
      expiresAt: current.expiresAt,
      lastActivityAt: current.lastActivityAt,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch {
      // Ignorar errores
    }

    set({ activeWarehouseId: warehouseId });
  },

  hasPermission: (module, action) => {
    const { user } = get();
    if (!user) return false;
    if (isSuperAdminRole(user.role)) return true;
    const targetPerm = `${module}.${action}`;
    return user.permissions.includes(targetPerm);
  },

  recordActivity: () => {
    const current = get();
    if (!current.isAuthenticated) return;
    const now = Date.now();
    // Limitar escrituras a localStorage: actualizar máximo cada 15 segundos
    if (current.lastActivityAt && now - current.lastActivityAt < 15_000) {
      return;
    }

    set({ lastActivityAt: now });
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.lastActivityAt = now;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {
      // Ignorar errores
    }
  },

  checkSessionValidity: () => {
    const { isAuthenticated, expiresAt, lastActivityAt, token, logout } = get();
    if (!isAuthenticated) return false;

    const now = Date.now();
    const jwtExp = token ? decodeJwtExp(token) : null;

    if (jwtExp !== null && now >= jwtExp) {
      logout('Su token de acceso ha expirado.');
      return false;
    }

    if (expiresAt && now >= expiresAt) {
      logout('Su sesión ha caducado por límite de tiempo (8 horas).');
      return false;
    }

    if (lastActivityAt && now - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
      logout('Su sesión ha expirado por inactividad (30 minutos).');
      return false;
    }

    return true;
  },

  clearSessionExpiredReason: () => {
    set({ sessionExpiredReason: null });
  },

  logout: (reason?: string) => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar errores
    }

    set({
      user: null,
      token: null,
      activeBranchId: null,
      activeWarehouseId: null,
      isAuthenticated: false,
      requires2FA: false,
      tempUser: null,
      expiresAt: null,
      lastActivityAt: null,
      sessionExpiredReason: reason || null,
    });
  },
}));
