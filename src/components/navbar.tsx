'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
}

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      }
    }
    loadSession();
  }, [router]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch {
      // Error
    }
  }

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <nav className="metallic-card border-b border-yellow-500/20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <a href="/" className="metallic-title text-base font-black tracking-wide">
              LIBRO CONTROL
            </a>
            <div className="hidden sm:flex items-center gap-1 ml-4">
              <a
                href={isSuperAdmin ? '/super-admin' : '/admin'}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === (isSuperAdmin ? '/super-admin' : '/admin')
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                Panel
              </a>
              <a
                href="/"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                Inicio
              </a>
              {isSuperAdmin && (
                <a
                  href="/reporte-mensual"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/reporte-mensual'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Reporte Mensual
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60 hidden sm:inline">
              {user?.name} ({user?.role === 'super_admin' ? 'Super Admin' : 'Admin'})
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
