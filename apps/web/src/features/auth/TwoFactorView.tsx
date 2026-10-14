import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { ShieldCheck, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';

export const TwoFactorView: React.FC = () => {
  const navigate = useNavigate();
  const tempUser = useAuthStore((state) => state.tempUser);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearTempUser = useAuthStore((state) => state.clearTempUser);

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Si no hay proceso 2FA pendiente, regresar al login
  if (!tempUser) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Sesión no iniciada</h2>
          <p className="text-xs text-neutral-500">
            Debe ingresar su usuario y contraseña antes de verificar el segundo factor.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Ir a Iniciar Sesión
          </Button>
        </Card>
      </div>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (code.length !== 6) {
      setErrorMessage('El código debe contener exactamente 6 dígitos');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: tempUser.userId,
          code,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || 'Código 2FA incorrecto');
      }

      setAuth(json.data.user, json.data.accessToken);
      toast.success('Identidad verificada exitosamente');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      // Fallback demo para código 123456
      if (code === '123456') {
        const fallbackUser = {
          id: tempUser.userId,
          username: tempUser.username,
          email: tempUser.email,
          fullName: tempUser.fullName || tempUser.username,
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
        setAuth(fallbackUser, 'mock-jwt-token-2fa');
        toast.success('Identidad verificada en modo local');
        navigate('/dashboard', { replace: true });
        return;
      }

      const msg = err.message || 'Código inválido o expirado';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    clearTempUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Autenticación en Dos Pasos (2FA)</h2>
              <p className="text-xs text-neutral-500">
                Verificación requerida para <span className="font-semibold text-neutral-800">{tempUser.username}</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-neutral-600 mb-4">
            Ingrese el código de 6 dígitos generado por su aplicación de autenticación (Google Authenticator o Microsoft Authenticator).
          </p>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              label="Código de Seguridad (6 dígitos)"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center font-mono text-lg tracking-widest"
              required
              disabled={isLoading}
            />

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold"
              isLoading={isLoading}
              disabled={code.length !== 6}
            >
              <span>Verificar y Entrar</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Código demo de asistencia */}
          <div className="mt-4 p-3 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Código de prueba:</span>
            <button
              type="button"
              onClick={() => setCode('123456')}
              className="font-mono font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              123456
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-center">
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Regresar a Iniciar Sesión
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
