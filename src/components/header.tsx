'use client';

import { useState, useEffect } from 'react';
import { LoginModal } from './login-modal';
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch {
        // Not logged in
      }
    }
    loadSession();
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } catch {
      // Error
    }
  }

  function handleLoginSuccess(loggedUser: User) {
    setUser(loggedUser);
    if (loggedUser.role === 'super_admin') {
      router.push('/super-admin');
    } else if (loggedUser.role === 'admin') {
      router.push('/admin');
    }
  }

  return (
    <>
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
              <a href="/" className="metallic-title text-lg sm:text-xl md:text-2xl font-black tracking-wide cursor-pointer">
                BOOK CONTROL CASA FDV
              </a>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-white/60 hidden sm:inline">
                    {user.name}
                  </span>
                  <div className="relative group">
                    <button className="flex items-center justify-center w-9 h-9 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 metallic-card rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <div className="px-3 py-2 border-b border-white/10">
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-white/50">{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
                      </div>
                      {(user.role === 'super_admin' || user.role === 'admin') && (
                        <a
                          href={user.role === 'super_admin' ? '/super-admin' : '/admin'}
                          className="block w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
                        >
                          Panel de Administración
                        </a>
                      )}
                      <a
                        href="/"
                        className="block w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
                      >
                        Inicio
                      </a>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                      >
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 text-white/60 hover:text-yellow-400 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors"
                  title="Iniciar Sesión"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.5" cy="8.5" r="4"/>
                    <path d="M2 21v-1a6 6 0 0 1 6-6h0"/>
                    <rect width="8" height="8" x="14" y="14" rx="2"/>
                    <path d="M18 16v4"/>
                    <path d="M16 18h4"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
