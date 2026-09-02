'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/navbar';
import { getScoreColor, getScoreLabel } from '@/lib/score-utils';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface AvailableMonth {
  month: number;
  year: number;
  month_name: string;
}

interface WeekInfo {
  id: string;
  week_number: number;
  label: string;
  sunday_date: string;
}

interface CriteriaBreakdownItem {
  criteria_id: string;
  criteria_name: string;
  total_score: number;
  count: number;
  average: number;
}

interface WeeklyBreakdownItem {
  week_id: string;
  week_number: number;
  label: string;
  sunday_date: string;
  total_score: number;
  count: number;
  average: number;
}

interface FamilyReport {
  family_id: string;
  family_name: string;
  family_color: string;
  student_count: number;
  students_with_grades: number;
  grades_count: number;
  total_score: number;
  average: number;
  position: number;
  criteria_breakdown: CriteriaBreakdownItem[];
  weekly_breakdown: WeeklyBreakdownItem[];
}

interface Top3Item {
  position: number;
  family_id: string;
  family_name: string;
  family_color: string;
  average: number;
  total_score: number;
  grades_count: number;
  student_count: number;
}

interface SummaryInfo {
  total_families: number;
  total_students: number;
  total_grades: number;
  global_average: number;
  weeks_count: number;
}

interface ReportData {
  month: number;
  year: number;
  month_name: string;
  weeks: WeekInfo[];
  families: FamilyReport[];
  top3: Top3Item[];
  summary: SummaryInfo;
}

export default function ReporteMensualPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Check session and super_admin role
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (!data.user || data.user.role !== 'super_admin') {
          setIsSuperAdmin(false);
          // Redirect to home after a brief delay
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
          return;
        }
        setIsSuperAdmin(true);
      } catch {
        setIsSuperAdmin(false);
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // 2) Fetch available months/years once we know user is super admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/monthly-report?available=1');
        const data = await res.json();
        if (data.available && Array.isArray(data.available)) {
          setAvailableMonths(data.available);
          const years = Array.from(new Set(data.available.map((m: AvailableMonth) => m.year))).sort(
            (a, b) => Number(b) - Number(a)
          );
          setAvailableYears(years as number[]);

          // Default selection: current month/year if available, else most recent available
          const now = new Date();
          const curMonth = now.getMonth() + 1;
          const curYear = now.getFullYear();

          const hasCurrent = data.available.find(
            (m: AvailableMonth) => m.month === curMonth && m.year === curYear
          );
          if (hasCurrent) {
            setSelectedMonth(curMonth);
            setSelectedYear(curYear);
          } else if (data.available.length > 0) {
            // Choose the most recent available month/year
            const sorted = [...data.available].sort(
              (a: AvailableMonth, b: AvailableMonth) => b.year - a.year || b.month - a.month
            );
            const mostRecent = sorted[0];
            setSelectedMonth(mostRecent.month);
            setSelectedYear(mostRecent.year);
          }
        }
      } catch (err) {
        console.error('Error fetching available months:', err);
      }
    })();
  }, [isSuperAdmin]);

  // 3) Fetch report whenever month/year changes
  const fetchReport = useCallback(async () => {
    if (!selectedMonth || !selectedYear) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/monthly-report?month=${selectedMonth}&year=${selectedYear}`
      );
      if (res.status === 403) {
        setError('No autorizado para ver el reporte mensual.');
        setReport(null);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setReport(null);
        return;
      }
      setReport(data as ReportData);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el reporte');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (isSuperAdmin && selectedMonth && selectedYear) {
      fetchReport();
    }
  }, [isSuperAdmin, selectedMonth, selectedYear, fetchReport]);

  // Months available for the selected year
  const monthsForSelectedYear = useMemo(() => {
    if (!selectedYear) return [];
    return availableMonths
      .filter((m) => m.year === selectedYear)
      .sort((a, b) => a.month - b.month);
  }, [availableMonths, selectedYear]);

  function getMedalIcon(position: number) {
    if (position === 1) {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50">
          <span className="text-2xl medal-gold">🥇</span>
        </div>
      );
    }
    if (position === 2) {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-400/20 border-2 border-gray-400/50">
          <span className="text-2xl medal-silver">🥈</span>
        </div>
      );
    }
    if (position === 3) {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-700/20 border-2 border-orange-700/50">
          <span className="text-2xl medal-bronze">🥉</span>
        </div>
      );
    }
    return null;
  }

  function getPositionLabel(position: number): string {
    if (position === 1) return '1er Lugar';
    if (position === 2) return '2do Lugar';
    if (position === 3) return '3er Lugar';
    return `${position}° Lugar`;
  }

  // Loading screen while auth is being checked
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-yellow-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-white/50 text-sm">Verificando acceso...</span>
        </div>
      </div>
    );
  }

  // Access denied screen
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="metallic-card rounded-xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Acceso restringido</h2>
          <p className="text-white/60 text-sm">
            Solo los Super Administradores pueden ver el Reporte Mensual. Serás redirigido al inicio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-black metallic-title">Reporte Mensual</h1>
            <p className="text-white/50 text-sm mt-1">
              Seleccione un mes y año para ver el resumen de los puestos en los que van todas las familias,
              junto con el Top 3 del periodo.
            </p>
          </div>

          {/* Filters */}
          <div className="metallic-card rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-xs font-bold uppercase tracking-wider text-yellow-500/80">
                Año
              </label>
              <select
                value={selectedYear ?? ''}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setSelectedYear(y);
                  // Reset month if not in selected year
                  const monthsInYear = availableMonths.filter((m) => m.year === y);
                  if (monthsInYear.length > 0) {
                    const exists = monthsInYear.find((m) => m.month === selectedMonth);
                    if (!exists) {
                      setSelectedMonth(monthsInYear.sort((a, b) => a.month - b.month)[0].month);
                    }
                  } else {
                    setSelectedMonth(null);
                  }
                }}
                className="bg-black/40 border border-yellow-500/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              >
                {availableYears.length === 0 && <option value="">Sin datos</option>}
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-xs font-bold uppercase tracking-wider text-yellow-500/80">
                Mes
              </label>
              <select
                value={selectedMonth ?? ''}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                disabled={!selectedYear || monthsForSelectedYear.length === 0}
                className="bg-black/40 border border-yellow-500/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 disabled:opacity-40"
              >
                {!selectedYear && <option value="">Primero elija un año</option>}
                {selectedYear && monthsForSelectedYear.length === 0 && (
                  <option value="">Sin semanas para este año</option>
                )}
                {monthsForSelectedYear.map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.month_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchReport}
              disabled={!selectedMonth || !selectedYear || loading}
              className="metallic-btn-gold rounded-md px-5 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Cargando...' : 'Generar Reporte'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="metallic-card rounded-xl p-4 border-l-4 border-red-500">
            <p className="text-red-400 text-sm font-medium">⚠ {error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-yellow-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-white/50 text-sm">Generando reporte...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && report && report.families.length === 0 && (
          <div className="metallic-card rounded-xl p-12 text-center">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="text-lg font-bold text-white/80 mb-2">No hay datos para este periodo</h3>
            <p className="text-white/50 text-sm">
              No se registraron calificaciones para {report.month_name} {report.year}.
              Seleccione otro mes/año o registre calificaciones primero.
            </p>
          </div>
        )}

        {/* Report content */}
        {!loading && !error && report && report.families.length > 0 && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="metallic-card rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider text-yellow-500/80 font-bold">Semanas</p>
                <p className="text-2xl font-black text-white mt-1">{report.summary.weeks_count}</p>
              </div>
              <div className="metallic-card rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider text-yellow-500/80 font-bold">Familias</p>
                <p className="text-2xl font-black text-white mt-1">{report.summary.total_families}</p>
              </div>
              <div className="metallic-card rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider text-yellow-500/80 font-bold">Estudiantes</p>
                <p className="text-2xl font-black text-white mt-1">{report.summary.total_students}</p>
              </div>
              <div className="metallic-card rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider text-yellow-500/80 font-bold">Promedio Global</p>
                <p
                  className="text-2xl font-black mt-1"
                  style={{ color: getScoreColor(report.summary.global_average) }}
                >
                  {report.summary.global_average.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Top 3 Section */}
            <div className="metallic-card rounded-xl p-5">
              <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
                🏆 Top 3 — {report.month_name} {report.year}
              </h2>
              {report.top3.length === 0 ? (
                <p className="text-white/50 text-sm">No hay datos para el Top 3.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.top3.map((item) => (
                    <a
                      key={item.family_id}
                      href={`/familia/${item.family_id}`}
                      className="metallic-card rounded-xl p-5 flex items-center gap-4 hover:bg-white/5 transition-all group cursor-pointer animate-fade-in-up"
                    >
                      {getMedalIcon(item.position)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                          {item.family_name}
                        </h3>
                        <p className="text-xs text-white/50">{getPositionLabel(item.position)}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {item.student_count} {item.student_count === 1 ? 'estudiante' : 'estudiantes'} ·{' '}
                          {item.grades_count} notas
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className="score-badge text-base"
                          style={{
                            backgroundColor: getScoreColor(item.average),
                            color: '#fff',
                            boxShadow: `0 0 12px ${getScoreColor(item.average)}33`,
                          }}
                        >
                          {item.average.toFixed(1)}
                        </span>
                        <p className="text-xs text-white/40 mt-1">{getScoreLabel(item.average)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Full standings table */}
            <div className="metallic-card rounded-xl p-5">
              <h2 className="text-lg font-bold text-yellow-400 mb-4">
                📊 Resumen Mensual de Puestos por Familia
              </h2>
              <div className="overflow-x-auto custom-scrollbar -mx-2 px-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-yellow-500/20">
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs">Puesto</th>
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs">Familia</th>
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs text-center">Estudiantes</th>
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs text-center">Notas</th>
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs text-center">Total Puntos</th>
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs text-center">Promedio /20</th>
                      <th className="py-2 px-3 font-bold text-yellow-500/80 uppercase tracking-wider text-xs text-center">Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.families.map((fam, idx) => (
                      <tr
                        key={fam.family_id}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          idx < 3 ? 'bg-yellow-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                fam.position === 1
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                  : fam.position === 2
                                  ? 'bg-gray-400/20 text-gray-300 border border-gray-400/40'
                                  : fam.position === 3
                                  ? 'bg-orange-700/20 text-orange-500 border border-orange-700/40'
                                  : 'bg-white/10 text-white/70'
                              }`}
                            >
                              {fam.position}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <a
                            href={`/familia/${fam.family_id}`}
                            className="flex items-center gap-2 group"
                          >
                            <div
                              className="w-3 h-8 rounded-full shrink-0"
                              style={{ backgroundColor: fam.family_color || '#D4AF37' }}
                            />
                            <span className="font-bold text-white group-hover:text-yellow-400 transition-colors">
                              {fam.family_name}
                            </span>
                          </a>
                        </td>
                        <td className="py-3 px-3 text-center text-white/70">{fam.student_count}</td>
                        <td className="py-3 px-3 text-center text-white/70">{fam.grades_count}</td>
                        <td className="py-3 px-3 text-center text-white/70">{fam.total_score.toFixed(1)}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className="score-badge"
                            style={{
                              backgroundColor: getScoreColor(fam.average),
                              color: '#fff',
                              boxShadow: `0 0 12px ${getScoreColor(fam.average)}33`,
                            }}
                          >
                            {fam.average.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-xs text-white/60">
                          {getScoreLabel(fam.average)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed breakdown - per family */}
            <div className="metallic-card rounded-xl p-5">
              <h2 className="text-lg font-bold text-yellow-400 mb-4">
                📋 Detalle por Familia — Promedios por Criterio
              </h2>
              <div className="space-y-4">
                {report.families.map((fam) => {
                  const activeCriteria = fam.criteria_breakdown.filter((c) => c.count > 0);
                  return (
                    <details
                      key={fam.family_id}
                      className="metallic-card rounded-lg p-0 overflow-hidden"
                    >
                      <summary className="cursor-pointer px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                        <div
                          className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0"
                          style={{
                            backgroundColor: fam.position <= 3 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.1)',
                            color: fam.position <= 3 ? '#D4AF37' : '#fff',
                          }}
                        >
                          {fam.position}
                        </div>
                        <div
                          className="w-3 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: fam.family_color || '#D4AF37' }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">{fam.family_name}</h3>
                          <p className="text-xs text-white/40">
                            {fam.student_count} estudiantes · {fam.grades_count} notas · {getPositionLabel(fam.position)}
                          </p>
                        </div>
                        <span
                          className="score-badge"
                          style={{
                            backgroundColor: getScoreColor(fam.average),
                            color: '#fff',
                            boxShadow: `0 0 12px ${getScoreColor(fam.average)}33`,
                          }}
                        >
                          {fam.average.toFixed(1)}
                        </span>
                      </summary>
                      <div className="px-4 pb-4 pt-2 border-t border-white/5">
                        {activeCriteria.length === 0 ? (
                          <p className="text-white/40 text-xs py-2">
                            No hay notas registradas para esta familia en el periodo.
                          </p>
                        ) : (
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-white/50">
                                  <th className="py-2 pr-3 font-bold">Criterio</th>
                                  <th className="py-2 px-3 font-bold text-center">Notas</th>
                                  <th className="py-2 px-3 font-bold text-center">Total</th>
                                  <th className="py-2 px-3 font-bold text-center">Promedio /20</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeCriteria.map((c) => (
                                  <tr key={c.criteria_id} className="border-t border-white/5">
                                    <td className="py-2 pr-3 text-white/80 font-medium">{c.criteria_name}</td>
                                    <td className="py-2 px-3 text-center text-white/60">{c.count}</td>
                                    <td className="py-2 px-3 text-center text-white/60">{c.total_score.toFixed(1)}</td>
                                    <td className="py-2 px-3 text-center">
                                      <span
                                        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold"
                                        style={{
                                          backgroundColor: getScoreColor(c.average),
                                          color: '#fff',
                                        }}
                                      >
                                        {c.average.toFixed(1)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Weekly breakdown */}
                        <div className="mt-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-yellow-500/70 mb-2">
                            Desempeño semanal
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {fam.weekly_breakdown.map((w) => (
                              <div
                                key={w.week_id}
                                className="rounded-md p-2 bg-black/30 border border-white/10"
                              >
                                <p className="text-xs text-white/50 truncate" title={w.label}>{w.label}</p>
                                <div className="flex items-baseline gap-1 mt-1">
                                  <span
                                    className="text-sm font-bold"
                                    style={{ color: getScoreColor(w.average) }}
                                  >
                                    {w.average.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-white/40">/20</span>
                                </div>
                                <p className="text-xs text-white/40 mt-0.5">
                                  {w.count} {w.count === 1 ? 'nota' : 'notas'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>

            {/* Weeks included */}
            <div className="metallic-card rounded-xl p-5">
              <h2 className="text-lg font-bold text-yellow-400 mb-3">
                🗓️ Semanas incluidas en el reporte
              </h2>
              {report.weeks.length === 0 ? (
                <p className="text-white/50 text-sm">No hay semanas registradas en este periodo.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.weeks.map((w) => (
                    <div
                      key={w.id}
                      className="px-3 py-1.5 rounded-md bg-black/30 border border-yellow-500/20 text-xs text-white/70"
                    >
                      <span className="text-yellow-500/80 font-bold mr-1">#{w.week_number}</span>
                      {w.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <footer className="mt-auto py-4 text-center text-white/30 text-xs border-t border-white/5">
        LIBRO CONTROL CASA FDV &copy; {new Date().getFullYear()} · Reporte Mensual (Super Admin)
      </footer>
    </div>
  );
}
