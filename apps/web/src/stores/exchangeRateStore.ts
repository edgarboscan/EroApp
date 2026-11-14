import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface ExchangeRateData {
  id?: string;
  rate: number;
  currencyBase: string;
  currencySecondary: string;
  effectiveDate: string;
  source: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ExchangeRateRecord extends ExchangeRateData {
  notes?: string | null;
}

export interface BcvLiveData {
  bcvRate: number;
  bcvEffectiveDate: string;
  bcvFormattedDate?: string;
  currentSystemRate: number;
  difference: number;
  needsUpdate: boolean;
  source: string;
  fetchedAt: string;
}

export interface CheckBcvResult {
  success: boolean;
  data?: BcvLiveData | null;
  error?: string;
  autoSyncDisabled?: boolean;
}

interface ExchangeRateState extends ExchangeRateData {
  isLoading: boolean;
  history: ExchangeRateRecord[];
  isHistoryLoading: boolean;
  bcvLiveData: BcvLiveData | null;
  isBcvChecking: boolean;
  isBcvSyncing: boolean;
  autoSyncBcv: boolean;
  lastBcvError: string | null;
  lastBcvAttemptAt: string | null;
  fetchRate: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchAutoSyncStatus: () => Promise<boolean>;
  setAutoSyncBcv: (enabled: boolean) => Promise<boolean>;
  updateRate: (newRate: number, source?: string, notes?: string) => Promise<boolean>;
  checkBcvLiveRate: (options?: { force?: boolean; isAutoCheck?: boolean }) => Promise<CheckBcvResult>;
  syncWithBcv: () => Promise<boolean>;
}

const STORAGE_KEY = 'ero_erp_exchange_rate';
const AUTO_SYNC_KEY = 'ero_erp_auto_sync_bcv';

const loadPersistedRate = (): ExchangeRateData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.rate === 'number' && parsed.rate > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  return {
    rate: 36.85,
    currencyBase: 'USD',
    currencySecondary: 'VES',
    effectiveDate: new Date().toISOString().split('T')[0],
    source: 'Banco Central de Venezuela (BCV)',
    updatedBy: 'Administrador General',
    updatedAt: new Date().toISOString(),
  };
};

const loadPersistedAutoSync = (): boolean => {
  try {
    const val = localStorage.getItem(AUTO_SYNC_KEY);
    if (val !== null) {
      return val === 'true';
    }
  } catch {}
  return true;
};

const initialData = loadPersistedRate();

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  ...initialData,
  isLoading: false,
  history: [],
  isHistoryLoading: false,
  autoSyncBcv: loadPersistedAutoSync(),
  lastBcvError: null,
  lastBcvAttemptAt: null,

  fetchRate: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      set({ isLoading: true });
      const res = await fetch('/api/config/exchange-rate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const data: ExchangeRateData = json.data;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {}
          set({ ...data });
        }
      }
    } catch {
      // Usar valor en memoria
    } finally {
      set({ isLoading: false });
    }
  },

  fetchHistory: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      set({ isHistoryLoading: true });
      const res = await fetch('/api/config/exchange-rate/history?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ history: json.data });
        }
      }
    } catch {
      // ignore
    } finally {
      set({ isHistoryLoading: false });
    }
  },

  fetchAutoSyncStatus: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return get().autoSyncBcv;

    try {
      const res = await fetch('/api/config/exchange-rate/auto-sync', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && typeof json.autoSyncBcv === 'boolean') {
          const enabled = json.autoSyncBcv;
          try {
            localStorage.setItem(AUTO_SYNC_KEY, String(enabled));
          } catch {}
          set({ autoSyncBcv: enabled });
          return enabled;
        }
      }
    } catch {
      // Mantener valor actual
    }
    return get().autoSyncBcv;
  },

  setAutoSyncBcv: async (enabled: boolean) => {
    const token = useAuthStore.getState().token;
    try {
      localStorage.setItem(AUTO_SYNC_KEY, String(enabled));
    } catch {}

    set({ autoSyncBcv: enabled, ...(enabled ? {} : { lastBcvError: null }) });

    if (token) {
      try {
        const res = await fetch('/api/config/exchange-rate/auto-sync', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ enabled }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && typeof json.autoSyncBcv === 'boolean') {
            set({ autoSyncBcv: json.autoSyncBcv });
            return json.autoSyncBcv;
          }
        }
      } catch {
        // Fallback local
      }
    }
    return enabled;
  },

  updateRate: async (newRate: number, source?: string, notes?: string) => {
    const token = useAuthStore.getState().token;
    const user = useAuthStore.getState().user;

    const data: ExchangeRateData = {
      rate: Number(newRate.toFixed(4)),
      currencyBase: 'USD',
      currencySecondary: 'VES',
      effectiveDate: new Date().toISOString().split('T')[0],
      source: source || 'Banco Central de Venezuela (BCV)',
      updatedBy: user?.fullName || user?.username || 'Usuario Autorizado',
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}

    set({ ...data });

    if (token) {
      try {
        const res = await fetch('/api/config/exchange-rate', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rate: newRate,
            source: data.source,
            notes: notes || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Error al actualizar tasa en el servidor');
        }

        if (json.data) {
          const syncedData: ExchangeRateData = json.data;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));
          } catch {}
          set({ ...syncedData, lastBcvError: null });
        }

        // Refrescar historial
        get().fetchHistory();
      } catch (err: any) {
        if (err.message && err.message.includes('No cuenta con permisos')) {
          throw err;
        }
        throw err;
      }
    }

    return true;
  },

  bcvLiveData: null,
  isBcvChecking: false,
  isBcvSyncing: false,

  checkBcvLiveRate: async (options) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      return { success: false, error: 'Sesión no activa' };
    }

    const isAutoCheck = options?.isAutoCheck === true;
    const force = options?.force === true;

    // Si es chequeo automatico y la sincronizacion automatica esta desactivada, omitir
    if (isAutoCheck && !get().autoSyncBcv) {
      return { success: false, autoSyncDisabled: true };
    }

    try {
      set({ isBcvChecking: true });
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force', 'true');
      if (isAutoCheck) queryParams.set('auto', 'true');

      const url = `/api/config/exchange-rate/bcv-live${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (res.ok && json.success && json.data) {
        const data: BcvLiveData = json.data;
        set({
          bcvLiveData: data,
          lastBcvError: null,
          lastBcvAttemptAt: new Date().toISOString(),
        });
        return { success: true, data };
      }

      if (json.autoSyncDisabled) {
        set({ autoSyncBcv: false });
        return { success: false, autoSyncDisabled: true };
      }

      const errorMsg =
        json.error?.message || json.error?.reason || 'No se pudo obtener la tasa oficial del BCV';
      set({
        lastBcvError: errorMsg,
        lastBcvAttemptAt: new Date().toISOString(),
      });
      return { success: false, error: errorMsg };
    } catch (err: any) {
      const netError = err.message || 'Error de red al consultar servicio de tasa BCV';
      set({
        lastBcvError: netError,
        lastBcvAttemptAt: new Date().toISOString(),
      });
      return { success: false, error: netError };
    } finally {
      set({ isBcvChecking: false });
    }
  },

  syncWithBcv: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return false;

    try {
      set({ isBcvSyncing: true });
      const res = await fetch('/api/config/exchange-rate/sync-bcv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al sincronizar con el BCV');
      }

      if (json.data) {
        const syncedData: ExchangeRateData = json.data;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));
        } catch {}
        set({
          ...syncedData,
          lastBcvError: null,
          bcvLiveData: get().bcvLiveData
            ? { ...get().bcvLiveData!, needsUpdate: false, difference: 0 }
            : null,
        });
      }

      // Refrescar historial
      get().fetchHistory();
      return true;
    } catch (err: any) {
      throw err;
    } finally {
      set({ isBcvSyncing: false });
    }
  },
}));
