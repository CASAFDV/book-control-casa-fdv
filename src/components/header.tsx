'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
}

interface HeaderProps {
  showBackButton?: boolean;
  backHref?: string;
}

export function Header({ showBackButton, backHref }: HeaderProps) {
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user) setUser(data.user);
      } catch {}
    }
    loadSession();
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowLogin(false);
      }
    }
    if (showLogin) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogin]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas');
        return;
      }
      setUser(data.user);
      setShowLogin(false);
      setUsername('');
      setPassword('');
      setError('');
      if (data.user.role === 'super_admin') {
        router.push('/super-admin');
      } else if (data.user.role === 'admin') {
        router.push('/admin');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } catch {}
  }

  return (
    <header className="sticky top-0 z-30 w-full">
      <div className="metallic-card rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && backHref && (
              <a
                href={backHref}
                className="flex items-center gap-1 text-white/70 hover:text-yellow-400 transition-colors mr-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
                <span className="text-sm hidden sm:inline">Volver</span>
              </a>
            )}
            <a href="/" className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="FDV" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain" />
              <span className="metallic-title text-lg sm:text-xl md:text-2xl font-black tracking-wide">
                LIBRO CONTROL CASA FDV
              </span>
            </a>
          </div>

          <div className="relative" ref={popoverRef}>
            {user ? (
              /* ---- Logged in: user menu ---- */
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-white/60 hidden sm:inline">
                  {user.name}
                </span>
                <button
                  onClick={() => setShowLogin(!showLogin)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </button>
              </div>
            ) : (
              /* ---- Not logged in: login icon ---- */
              <button
                onClick={() => { setShowLogin(!showLogin); setError(''); }}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 text-white/60 hover:text-yellow-400 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors"
                title="Iniciar Sesión"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </button>
            )}

            {/* ---- Popover balloon ---- */}
            {showLogin && (
              <div className="absolute right-0 top-full mt-2 w-72 metallic-card rounded-xl shadow-2xl border border-yellow-500/30 z-50 overflow-hidden"
                style={{ animation: 'fadeInScale 0.15s ease-out' }}
              >
                {user ? (
                  /* User menu */
                  <div>
                    <div className="px-4 py-3 border-b border-white/10 bg-yellow-500/5">
                      <p className="text-sm font-bold text-white">{user.name}</p>
                      <p className="text-xs text-yellow-400/80">{user.role === 'super_admin' ? 'Super Administrador' : 'Administrador'}</p>
                    </div>
                    <div className="py-1">
                      {(user.role === 'super_admin' || user.role === 'admin') && (
                        <a
                          href={user.role === 'super_admin' ? '/super-admin' : '/admin'}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                          </svg>
                          Panel de Administración
                        </a>
                      )}
                      <a
                        href="/"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        Inicio
                      </a>
                      <button
                        onClick={() => { handleLogout(); setShowLogin(false); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
                        </svg>
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Login form */
                  <div className="p-4">
                    <div className="text-center mb-3">
                      <p className="text-sm font-bold text-white">Iniciar Sesión</p>
                      <p className="text-xs text-white/40 mt-0.5">CASA FDV</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-3">
                      {error && (
                        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg text-xs text-center">
                          {error}
                        </div>
                      )}
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Usuario"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none transition-colors"
                        required
                        autoComplete="username"
                        autoFocus
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none transition-colors"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full metallic-btn text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Ingresando...' : 'Ingresar'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
}
