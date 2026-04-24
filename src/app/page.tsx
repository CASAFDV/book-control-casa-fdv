'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { WeekSelector } from '@/components/week-selector';
import { getScoreColor, getScoreColorClass, getScoreLabel } from '@/lib/score-utils';

interface WeeklyRanking {
  family_id: string;
  family_name: string;
  family_color: string;
  average: number;
  student_count: number;
  students: {
    student_id: string;
    student_name: string;
    average: number;
    criteria_grades: { criteria_id: string; criteria_name: string; score: number }[];
  }[];
}

interface MonthlyRanking {
  family_id: string;
  family_name: string;
  family_color: string;
  average: number;
  student_count: number;
}

export default function HomePage() {
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [weeklyRanking, setWeeklyRanking] = useState<WeeklyRanking[]>([]);
  const [monthlyRanking, setMonthlyRanking] = useState<MonthlyRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  const fetchRankings = useCallback(async (weekId: string) => {
    setLoading(true);
    try {
      const [weeklyRes, monthlyRes] = await Promise.all([
        fetch(`/api/rankings?type=weekly&week_id=${weekId}`),
        fetch(`/api/rankings?type=monthly&month=${currentMonth}&year=${currentYear}`),
      ]);
      const weeklyData = await weeklyRes.json();
      const monthlyData = await monthlyRes.json();
      setWeeklyRanking(weeklyData.weeklyRanking || []);
      setMonthlyRanking(monthlyData.monthlyRanking || []);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
  }, []);

  useEffect(() => {
    if (selectedWeekId) {
      fetchRankings(selectedWeekId);
    }
  }, [selectedWeekId, fetchRankings]);

  function getMedalIcon(position: number) {
    if (position === 0) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50">
          <span className="text-xl medal-gold">🥇</span>
        </div>
      );
    }
    if (position === 1) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-400/20 border-2 border-gray-400/50">
          <span className="text-xl medal-silver">🥈</span>
        </div>
      );
    }
    if (position === 2) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-700/20 border-2 border-orange-700/50">
          <span className="text-xl medal-bronze">🥉</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Week Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-white/80">Ranking Semanal</h2>
          <WeekSelector
            selectedWeekId={selectedWeekId}
            onWeekChange={setSelectedWeekId}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-yellow-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-white/50 text-sm">Cargando rankings...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Ranking - Full List */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500/80">
                Ranking Semanal por Familias
              </h3>
              {weeklyRanking.length === 0 ? (
                <div className="metallic-card rounded-xl p-8 text-center">
                  <p className="text-white/50">No hay datos para esta semana</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {weeklyRanking.map((family, index) => (
                    <a
                      key={family.family_id}
                      href={`/familia/${family.family_id}`}
                      className="metallic-card rounded-xl p-4 flex items-center gap-4 hover:bg-white/5 transition-all group animate-fade-in-up cursor-pointer"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      {/* Position */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/70 font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      {/* Family color indicator */}
                      <div
                        className="w-3 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: family.family_color || '#D4AF37' }}
                      />
                      {/* Family info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                          {family.family_name}
                        </h4>
                        <p className="text-xs text-white/40">
                          {family.student_count} {family.student_count === 1 ? 'estudiante' : 'estudiantes'}
                        </p>
                      </div>
                      {/* Score */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="score-badge"
                          style={{
                            backgroundColor: getScoreColor(family.average),
                            color: family.average >= 12.5 ? '#fff' : '#fff',
                            boxShadow: `0 0 12px ${getScoreColor(family.average)}33`,
                          }}
                        >
                          {family.average.toFixed(1)}
                        </span>
                        <span className="text-xs text-white/40 hidden sm:inline">
                          {getScoreLabel(family.average)}
                        </span>
                      </div>
                      {/* Arrow */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 group-hover:text-yellow-400 transition-colors shrink-0">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Ranking - Top 3 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500/80">
                Top Mensual
              </h3>
              {monthlyRanking.length === 0 ? (
                <div className="metallic-card rounded-xl p-8 text-center">
                  <p className="text-white/50">No hay datos mensuales</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlyRanking.slice(0, 3).map((family, index) => (
                    <a
                      key={family.family_id}
                      href={`/familia/${family.family_id}`}
                      className="metallic-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-all group cursor-pointer animate-fade-in-up"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      {getMedalIcon(index)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors text-sm truncate">
                          {family.family_name}
                        </h4>
                        <p className="text-xs text-white/40">
                          {index === 0 ? '1er Lugar' : index === 1 ? '2do Lugar' : '3er Lugar'}
                        </p>
                      </div>
                      <span
                        className="score-badge text-sm"
                        style={{
                          backgroundColor: getScoreColor(family.average),
                          color: '#fff',
                          boxShadow: `0 0 12px ${getScoreColor(family.average)}33`,
                        }}
                      >
                        {family.average.toFixed(1)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <footer className="mt-auto py-4 text-center text-white/30 text-xs border-t border-white/5">
        BOOK CONTROL CASA FDV &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
