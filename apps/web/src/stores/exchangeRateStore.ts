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

interface ExchangeRateState extends ExchangeRateData {
  isLoading: boolean;
  history: ExchangeRateRecord[];
  isHistoryLoading: boolean;
  fetchRate: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  updateRate: (newRate: number, source?: string, notes?: string) => Promise<boolean>;
}

const STORAGE_KEY = 'ero_erp_exchange_rate';

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

const initialData = loadPersistedRate();

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  ...initialData,
  isLoading: false,
  history: [],
  isHistoryLoading: false,

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
          set({ ...syncedData });
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
}));
