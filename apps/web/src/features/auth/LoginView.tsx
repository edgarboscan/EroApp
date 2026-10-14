import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { Lock, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setRequires2FA = useAuthStore((state) => state.setRequires2FA);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFillDemo = () => {
    setUsernameOrEmail('admin');
    setPassword('Admin123!');
    setErrorMessage('');
    toast.info('Credenciales de demostrador cargadas');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Por favor ingrese usuario y contraseña');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || 'Error de autenticación');
      }

      if (json.data.requires2FA) {
        setRequires2FA({
          userId: json.data.userId,
          username: json.data.username,
          email: json.data.email,
          fullName: json.data.fullName,
        });
        toast.info('Verificación en dos pasos requerida');
        navigate('/2fa');
        return;
      }

      setAuth(json.data.user, json.data.accessToken);
      toast.success('Sesión iniciada correctamente');

      const destination = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err: any) {
      // Fallback para testing local
      if (
        (usernameOrEmail === 'admin' || usernameOrEmail === 'admin@erove.com.ve') &&
        password === 'Admin123!'
      ) {
        const fallbackUser = {
          id: 'u1111111-1111-1111-1111-111111111111',
          username: 'admin',
          email: 'admin@erove.com.ve',
          fullName: 'Ing. Edgar Boscán',
          role: 'super_admin',
          companyId: 'c1111111-1111-1111-1111-111111111111',
          branchId: 'b1111111-1111-1111-1111-111111111111',
          warehouseId: 'w1111111-1111-1111-1111-111111111111',
          permissions: [
            'dashboards.read', 'dashboards.update',
            'inventory.read', 'inventory.create', 'inventory.update', 'inventory.adjust',
            'pricing.read', 'pricing.bulk_update', 'pricing.apply_tax',
            'sales.read', 'sales.create',
            'pos.read', 'pos.close_register',
            'receivables.read', 'payables.read', 'treasury.read', 'taxes.read',
            'reports.export_pdf', 'reports.export_excel'
          ],
        };
        setAuth(fallbackUser, 'mock-jwt-token-local');
        toast.success('Sesión iniciada en modo local');
        navigate('/dashboard', { replace: true });
        return;
      }

      const msg = err.message || 'Credenciales inválidas';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-sky-700 flex items-center justify-center text-white font-bold text-lg">
            E
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-neutral-900 block leading-tight">
              ERO ERP VE
            </span>
            <span className="text-[11px] text-neutral-500 font-medium block">
              Control Administrativo, Fiscal y Comercial
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8">
          <div className="mb-6 border-b border-neutral-200 pb-4">
            <h2 className="text-base font-bold text-neutral-900">Iniciar Sesión</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Ingrese sus credenciales corporativas para acceder al sistema
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario o Correo Corporativo"
              type="text"
              placeholder="admin@erove.com.ve o admin"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <div>
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <div className="flex justify-end mt-1">
                <span className="text-[11px] text-neutral-500 hover:text-neutral-700 cursor-pointer">
                  ¿Olvidó su contraseña?
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold mt-2"
              isLoading={isLoading}
            >
              <span>Acceder al Sistema</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Botón y Bloque de Ayuda Demo */}
          <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full py-2.5 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-neutral-500" />
              <span>Usar Credenciales de Demostración (Admin)</span>
            </button>

            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                Seguridad SENIAT / Providencia SNAT
              </span>
              <span className="font-mono">v1.0.0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
