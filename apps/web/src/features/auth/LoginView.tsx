import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getDefaultAppRoute } from '../../lib/navigation';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import {
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface QuickAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  avatarInitials: string;
  lastLogin: string;
}

const QUICK_ACCOUNTS_STORAGE_KEY = 'ero_quick_accounts';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setRequires2FA = useAuthStore((state) => state.setRequires2FA);

  // Modo de visualización: LOGIN, CHANGE_PASSWORD, RECOVER_PASSWORD
  const [mode, setMode] = useState<'LOGIN' | 'CHANGE_PASSWORD' | 'RECOVER_PASSWORD'>('LOGIN');

  // Estado del Login
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveQuickLogin, setSaveQuickLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cuentas de Inicio Rápido
  const [quickAccounts, setQuickAccounts] = useState<QuickAccount[]>([]);
  const [selectedQuickAccount, setSelectedQuickAccount] = useState<QuickAccount | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  // Estado de Cambio de Contraseña
  const [changeUsername, setChangeUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showChangePasswords, setShowChangePasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState('');

  // Estado de Recuperación de Contraseña
  const [recoverUsername, setRecoverUsername] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverNewPassword, setRecoverNewPassword] = useState('');
  const [recoverConfirmPassword, setRecoverConfirmPassword] = useState('');
  const [showRecoverPasswords, setShowRecoverPasswords] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [recoverInfo, setRecoverInfo] = useState<{ maskedEmail?: string; hint?: string } | null>(null);

  // Cargar cuentas recordadas al iniciar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_ACCOUNTS_STORAGE_KEY);
      if (raw) {
        const parsed: QuickAccount[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuickAccounts(parsed);
          setSelectedQuickAccount(parsed[0]);
          setUsernameOrEmail(parsed[0].username);
        }
      }
    } catch {
      // Ignorar error de parseo en almacenamiento local
    }
  }, []);

  // Escuchar tecla Escape para cancelar y volver al Login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode !== 'LOGIN') {
          setMode('LOGIN');
          setErrorMessage('');
          setChangeError('');
          setRecoverError('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Guardar cuenta en Inicio Rápido
  const saveToQuickAccounts = (user: any) => {
    try {
      const raw = localStorage.getItem(QUICK_ACCOUNTS_STORAGE_KEY);
      const list: QuickAccount[] = raw ? JSON.parse(raw) : [];

      const displayName = user.fullName || user.username || usernameOrEmail;
      const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map((part: string) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';

      const newAcc: QuickAccount = {
        id: user.id || usernameOrEmail,
        username: user.username || usernameOrEmail,
        fullName: displayName,
        email: user.email || '',
        role: user.role || 'Usuario',
        avatarInitials: initials,
        lastLogin: new Date().toISOString(),
      };

      const remaining = list.filter((a) => a.username.toLowerCase() !== newAcc.username.toLowerCase());
      const updated = [newAcc, ...remaining].slice(0, 4); // mantener máximo 4 cuentas rápidas
      localStorage.setItem(QUICK_ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
      setQuickAccounts(updated);
    } catch {
      // Ignorar errores de localStorage
    }
  };

  // Eliminar una cuenta de Inicio Rápido
  const handleRemoveQuickAccount = (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    try {
      const raw = localStorage.getItem(QUICK_ACCOUNTS_STORAGE_KEY);
      const list: QuickAccount[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter((a) => a.username.toLowerCase() !== username.toLowerCase());
      localStorage.setItem(QUICK_ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
      setQuickAccounts(updated);
      toast.success(`Cuenta @${username} eliminada del inicio rápido`);

      if (selectedQuickAccount?.username.toLowerCase() === username.toLowerCase()) {
        if (updated.length > 0) {
          setSelectedQuickAccount(updated[0]);
          setUsernameOrEmail(updated[0].username);
        } else {
          setSelectedQuickAccount(null);
          setUsernameOrEmail('');
          setShowManualForm(true);
        }
      }
    } catch {
      // Ignorar
    }
  };

  // Seleccionar una cuenta rápida
  const handleSelectQuickAccount = (acc: QuickAccount) => {
    setSelectedQuickAccount(acc);
    setUsernameOrEmail(acc.username);
    setPassword('');
    setErrorMessage('');
    setShowManualForm(false);
  };

  // Cargar credenciales de demostrador
  const handleFillDemo = () => {
    setSelectedQuickAccount(null);
    setShowManualForm(true);
    setUsernameOrEmail('admin');
    setPassword('Admin123!');
    setErrorMessage('');
    toast.info('Credenciales de demostrador cargadas (Super Admin)');
  };

  // Login normal
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const targetUser = usernameOrEmail.trim();
    if (!targetUser || !password) {
      setErrorMessage('Por favor ingrese su usuario y contraseña');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: targetUser, password }),
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

      if (saveQuickLogin) {
        saveToQuickAccounts(json.data.user);
      }

      setAuth(json.data.user, json.data.accessToken);
      toast.success(`¡Bienvenido, ${json.data.user.fullName || json.data.user.username}!`);

      const rawDest = (location.state as any)?.from?.pathname;
      const defaultLanding = getDefaultAppRoute(useAuthStore.getState().hasPermission);
      const destination = (rawDest && rawDest !== '/dashboard') ? rawDest : defaultLanding;
      navigate(destination, { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Credenciales inválidas';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejador de Cambio de Contraseña
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');

    if (!changeUsername.trim() || !currentPassword || !newPassword) {
      setChangeError('Por favor complete todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      setChangeError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangeError('Las nuevas contraseñas no coinciden');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: changeUsername.trim(),
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al cambiar la contraseña');
      }

      toast.success('¡Contraseña actualizada exitosamente! Inicie sesión con su nueva clave.');
      setUsernameOrEmail(changeUsername.trim());
      setPassword('');
      setChangeUsername('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('LOGIN');
    } catch (err: any) {
      const msg = err.message || 'Error al cambiar la contraseña';
      setChangeError(msg);
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Manejador de Recuperación de Contraseña
  const handleRecoverRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError('');

    if (!recoverUsername.trim()) {
      setRecoverError('Ingrese su usuario o correo corporativo');
      return;
    }

    setIsRecovering(true);

    try {
      const res = await fetch('/api/auth/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: recoverUsername.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al solicitar recuperación');
      }

      setRecoverInfo({
        maskedEmail: json.data?.maskedEmail,
        hint: json.data?.hint,
      });
      setRecoveryStep(2);
      toast.info('Código de seguridad generado. Ingrese el código para restablecer su clave.');
    } catch (err: any) {
      const msg = err.message || 'No se encontró la cuenta especificada';
      setRecoverError(msg);
      toast.error(msg);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError('');

    if (!recoveryCode.trim() || !recoverNewPassword) {
      setRecoverError('Complete todos los campos de seguridad');
      return;
    }

    if (recoverNewPassword.length < 6) {
      setRecoverError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (recoverNewPassword !== recoverConfirmPassword) {
      setRecoverError('Las nuevas contraseñas no coinciden');
      return;
    }

    setIsRecovering(true);

    try {
      const res = await fetch('/api/auth/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: recoverUsername.trim(),
          recoveryCode: recoveryCode.trim(),
          newPassword: recoverNewPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al restablecer la contraseña');
      }

      toast.success('¡Contraseña restablecida exitosamente! Ya puede iniciar sesión.');
      setUsernameOrEmail(recoverUsername.trim());
      setPassword('');
      setRecoverUsername('');
      setRecoveryCode('');
      setRecoverNewPassword('');
      setRecoverConfirmPassword('');
      setRecoveryStep(1);
      setMode('LOGIN');
    } catch (err: any) {
      const msg = err.message || 'Error al verificar el código de recuperación';
      setRecoverError(msg);
      toast.error(msg);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col lg:flex-row select-none">
      {/* Columna Izquierda: Panel de Autenticación y Formularios */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 bg-white border-r border-neutral-200 shrink-0 min-h-screen">
        {/* Brand Header y Formularios */}
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-700 flex items-center justify-center text-white font-black text-lg tracking-wider shadow-sm">
                E
              </div>
              <div className="text-left">
                <span className="text-lg font-bold tracking-tight text-neutral-900 leading-tight block">
                  ERO ERP VE
                </span>
                <span className="text-[11px] font-medium text-neutral-500 tracking-wide block">
                  Gestión Fiscal & Comercial Homologada
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
              v1.0.0
            </span>
          </div>

          {/* Contenedor Principal de Formularios */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* ========================================================================= */}
            {/* MODO 1: LOGIN PRINCIPAL (CON INICIO RÁPIDO & CREDENCIALES) */}
            {/* ========================================================================= */}
            {mode === 'LOGIN' && (
              <div className="space-y-5">
                {/* Encabezado de Sección */}
                <div className="border-b border-neutral-100 pb-3">
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900">Iniciar Sesión</h1>
                  <p className="text-xs text-neutral-500 mt-1">
                    Acceda a su terminal de facturación y control empresarial
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* SECCIÓN DE INICIO RÁPIDO (Cuentas Recordadas) */}
                {quickAccounts.length > 0 && !showManualForm && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                        Inicio Rápido (Cuentas Recordadas):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowManualForm(true);
                          setSelectedQuickAccount(null);
                          setUsernameOrEmail('');
                          setPassword('');
                        }}
                        className="text-[11px] font-medium text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
                      >
                        Usar otra cuenta
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {quickAccounts.map((acc) => {
                        const isSelected = selectedQuickAccount?.username === acc.username;
                        return (
                          <div
                            key={acc.username}
                            onClick={() => handleSelectQuickAccount(acc)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                              isSelected
                                ? 'border-sky-500 bg-sky-50/50 shadow-sm'
                                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/70'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs shrink-0 border border-sky-200">
                                {acc.avatarInitials}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-neutral-900 truncate">
                                  {acc.fullName}
                                </div>
                                <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-1.5 truncate">
                                  <span>@{acc.username}</span>
                                  <span className="text-neutral-300">•</span>
                                  <span className="capitalize">{acc.role.replace('_', ' ')}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-sky-600 mr-1" title="Seleccionado" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleRemoveQuickAccount(e, acc.username)}
                                className="text-neutral-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                title="Eliminar de inicio rápido"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FORMULARIO DE ACCESO (Rápido o Manual) */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Si no hay cuenta rápida o eligió usar otra cuenta, muestra campo de Usuario */}
                  {(showManualForm || quickAccounts.length === 0) && (
                    <div>
                      <Input
                        label="Usuario o Correo Corporativo"
                        type="text"
                        placeholder="admin@erove.com.ve o admin"
                        value={usernameOrEmail}
                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        autoFocus
                      />
                      {quickAccounts.length > 0 && (
                        <div className="flex justify-end mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowManualForm(false);
                              if (quickAccounts.length > 0) {
                                setSelectedQuickAccount(quickAccounts[0]);
                                setUsernameOrEmail(quickAccounts[0].username);
                              }
                            }}
                            className="text-[11px] text-sky-700 hover:underline cursor-pointer"
                          >
                            ← Volver a cuentas de inicio rápido
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Campo Contraseña */}
                  <div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="text-xs font-semibold text-neutral-700 tracking-wide flex items-center justify-between">
                        <span>
                          Contraseña {selectedQuickAccount && !showManualForm && `para ${selectedQuickAccount.fullName}`}
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isLoading}
                          required
                          autoFocus={!showManualForm && quickAccounts.length > 0}
                          className="h-10 w-full pl-3 pr-10 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
                          title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('CHANGE_PASSWORD');
                          setChangeUsername(usernameOrEmail);
                          setErrorMessage('');
                        }}
                        className="text-neutral-500 hover:text-sky-700 hover:underline cursor-pointer"
                      >
                        Cambiar clave
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('RECOVER_PASSWORD');
                          setRecoverUsername(usernameOrEmail);
                          setRecoveryStep(1);
                          setErrorMessage('');
                        }}
                        className="text-neutral-500 hover:text-sky-700 hover:underline cursor-pointer"
                      >
                        ¿Olvidó su contraseña?
                      </button>
                    </div>
                  </div>

                  {/* Casilla de Inicio Rápido */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-700 select-none pt-1">
                    <input
                      type="checkbox"
                      checked={saveQuickLogin}
                      onChange={(e) => setSaveQuickLogin(e.target.checked)}
                      className="mt-0.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-neutral-800">
                        Guardar para Inicio Rápido en este equipo
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        Permite iniciar sesión fácilmente con 1-clic desde este navegador
                      </span>
                    </div>
                  </label>

                  {/* Botón Principal de Acceso */}
                  <Button
                    type="submit"
                    className="w-full h-11 text-xs font-bold tracking-wide shadow-sm"
                    isLoading={isLoading}
                  >
                    <span>Acceder al Sistema</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </form>

                {/* Botón y Bloque de Ayuda Demo */}
                <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="w-full py-2 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Cargar Credenciales de Demo (Admin)</span>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MODO 2: CAMBIAR CONTRASEÑA */}
            {/* ========================================================================= */}
            {mode === 'CHANGE_PASSWORD' && (
              <div className="space-y-4">
                <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setChangeError('');
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
                      title="Volver al Login (Esc)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900">Cambiar Contraseña</h2>
                      <p className="text-xs text-neutral-500">
                        Actualice su clave corporativa de acceso
                      </p>
                    </div>
                  </div>
                </div>

                {changeError && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{changeError}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
                  <Input
                    label="Usuario o Correo Corporativo *"
                    type="text"
                    placeholder="admin o usuario@erove.com.ve"
                    value={changeUsername}
                    onChange={(e) => setChangeUsername(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-neutral-700 tracking-wide">
                      Contraseña Actual *
                    </label>
                    <div className="relative">
                      <input
                        type={showChangePasswords ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isChangingPassword}
                        required
                        className="h-10 w-full pl-3 pr-10 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowChangePasswords((prev) => !prev)}
                        className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
                      >
                        {showChangePasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-neutral-700 tracking-wide">
                      Nueva Contraseña (mínimo 6 caracteres) *
                    </label>
                    <input
                      type={showChangePasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isChangingPassword}
                      required
                      className="h-10 w-full px-3 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-neutral-700 tracking-wide">
                      Confirmar Nueva Contraseña *
                    </label>
                    <input
                      type={showChangePasswords ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isChangingPassword}
                      required
                      className="h-10 w-full px-3 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode('LOGIN');
                        setChangeError('');
                      }}
                    >
                      Cancelar (Esc)
                    </Button>
                    <Button
                      type="submit"
                      className="font-bold shadow-sm"
                      isLoading={isChangingPassword}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Actualizar Contraseña
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MODO 3: RECUPERAR CONTRASEÑA */}
            {/* ========================================================================= */}
            {mode === 'RECOVER_PASSWORD' && (
              <div className="space-y-4">
                <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setRecoverError('');
                        setRecoveryStep(1);
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
                      title="Volver al Login (Esc)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900">Recuperar Acceso</h2>
                      <p className="text-xs text-neutral-500">
                        {recoveryStep === 1
                          ? 'Identificación de usuario o correo corporativo'
                          : 'Validación de código y asignación de nueva clave'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-800 rounded border border-sky-200">
                    Paso {recoveryStep} de 2
                  </span>
                </div>

                {recoverError && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{recoverError}</span>
                  </div>
                )}

                {recoveryStep === 1 && (
                  <form onSubmit={handleRecoverRequest} className="space-y-3.5 text-xs">
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Ingrese el nombre de usuario o correo con el que está registrado en el ERP para generar el código de validación.
                    </p>

                    <Input
                      label="Usuario o Correo Corporativo *"
                      type="text"
                      placeholder="admin o usuario@erove.com.ve"
                      value={recoverUsername}
                      onChange={(e) => setRecoverUsername(e.target.value)}
                      disabled={isRecovering}
                      required
                      autoFocus
                    />

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMode('LOGIN');
                          setRecoverError('');
                        }}
                      >
                        Cancelar (Esc)
                      </Button>
                      <Button
                        type="submit"
                        className="font-bold shadow-sm"
                        isLoading={isRecovering}
                      >
                        <span>Continuar</span>
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Button>
                    </div>
                  </form>
                )}

                {recoveryStep === 2 && (
                  <form onSubmit={handleRecoverSubmit} className="space-y-3.5 text-xs">
                    {recoverInfo && (
                      <div className="p-3 rounded-lg border border-sky-200 bg-sky-50 text-xs text-sky-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-sky-700" />
                          Código de verificación generado
                        </div>
                        <p className="text-[11px] text-sky-800">
                          {recoverInfo.maskedEmail && `Asociado a: ${recoverInfo.maskedEmail}. `}
                          {recoverInfo.hint || 'Ingrese el código de 6 dígitos para autorizar el cambio.'}
                        </p>
                      </div>
                    )}

                    <Input
                      label="Código de Seguridad (6 dígitos) *"
                      type="text"
                      placeholder="123456"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      disabled={isRecovering}
                      required
                      autoFocus
                      className="font-mono text-center tracking-widest font-bold"
                    />

                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="text-xs font-semibold text-neutral-700 tracking-wide">
                        Nueva Contraseña *
                      </label>
                      <div className="relative">
                        <input
                          type={showRecoverPasswords ? 'text' : 'password'}
                          value={recoverNewPassword}
                          onChange={(e) => setRecoverNewPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isRecovering}
                          required
                          className="h-10 w-full pl-3 pr-10 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRecoverPasswords((prev) => !prev)}
                          className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
                        >
                          {showRecoverPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="text-xs font-semibold text-neutral-700 tracking-wide">
                        Confirmar Nueva Contraseña *
                      </label>
                      <input
                        type={showRecoverPasswords ? 'text' : 'password'}
                        value={recoverConfirmPassword}
                        onChange={(e) => setRecoverConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isRecovering}
                        required
                        className="h-10 w-full px-3 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRecoveryStep(1)}
                      >
                        Atrás
                      </Button>
                      <Button
                        type="submit"
                        className="font-bold shadow-sm"
                        isLoading={isRecovering}
                      >
                        <Check className="w-4 h-4 mr-1.5" />
                        Restablecer y Guardar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Institucional y Cumplimiento SENIAT */}
        <div className="pt-6 mt-8 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Providencias SENIAT SNAT/2024</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-neutral-500 font-medium">Servidor Activo</span>
          </span>
        </div>
      </div>

      {/* Columna Derecha: Showcase Alegórico con Imagen de Arquitectura ERP */}
      <div className="hidden lg:flex flex-1 relative bg-neutral-950 flex-col justify-between p-10 xl:p-14 overflow-hidden">
        {/* Imagen Alegórica de Fondo */}
        <img
          src="/erp-hero.jpg"
          alt="Arquitectura y Cadena Logística ERP"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-70"
          loading="eager"
        />
        {/* Capa de Gradiente para Contraste Impecable */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-neutral-950/20" />

        {/* Top Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-200 text-xs font-medium backdrop-blur-sm shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            Sistema Integrado de Planificación y Control
          </span>
          <span className="text-xs text-neutral-400 font-mono">
            Venezuela • Multi-Moneda
          </span>
        </div>

        {/* Bottom Feature Showcase */}
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block">
              Operaciones en Tiempo Real
            </span>
            <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Control Unificado de Inventarios, Ventas y Cumplimiento Fiscal
            </h2>
            <p className="text-xs xl:text-sm text-neutral-300 leading-relaxed">
              Gestione depósitos físicos, libros de ventas y compras, conciliaciones bancarias multimoneda y retenciones de IVA/ISLR con cálculo oficial BCV integrado.
            </p>
          </div>

          {/* Tarjetas de Métricas / Pilares */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-lg bg-neutral-900/70 border border-neutral-800/90 backdrop-blur-xs">
              <span className="text-xs font-bold text-white block">Facturación & Despachos</span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Control de correlativos, notas de entrega y CxC</span>
            </div>
            <div className="p-3.5 rounded-lg bg-neutral-900/70 border border-neutral-800/90 backdrop-blur-xs">
              <span className="text-xs font-bold text-white block">Kardex & Múltiples Almacenes</span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Costeo promedio ponderado y traslados seguros</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
