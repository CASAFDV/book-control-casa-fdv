'use client';

import { useEffect, useState, useMemo } from 'react';

interface Week {
  id: string;
  academic_year_id: string;
  week_number: number;
  month: number;
  year: number;
  month_name: string;
  sunday_date: string;
  label: string;
}

interface WeekSelectorProps {
  selectedWeekId: string | null;
  onWeekChange: (weekId: string) => void;
}

interface GroupedWeeks {
  [key: string]: Week[];
}

export function WeekSelector({ selectedWeekId, onWeekChange }: WeekSelectorProps) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [groupedWeeks, setGroupedWeeks] = useState<GroupedWeeks>({});
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (selectedWeekId && weeks.length > 0) {
      const week = weeks.find(w => w.id === selectedWeekId);
      if (week) return week.label;
    }
    return 'Seleccionar semana';
  }, [selectedWeekId, weeks]);

  useEffect(() => {
    async function loadWeeks() {
      try {
        const res = await fetch('/api/years');
        const data = await res.json();
        const yearsList = data.years || [];

        const activeYear = yearsList.find((y: { is_active: number }) => y.is_active === 1) || yearsList[0];
        if (!activeYear) return;

        const weeksRes = await fetch(`/api/weeks?year_id=${activeYear.id}`);
        const weeksData = await weeksRes.json();
        const weeksList: Week[] = weeksData.weeks || [];
        setWeeks(weeksList);

        // Group by month
        const grouped: GroupedWeeks = {};
        for (const week of weeksList) {
          const key = `${week.month_name} ${week.year}`;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(week);
        }
        setGroupedWeeks(grouped);

        // Auto-select current week if none selected
        if (!selectedWeekId && weeksList.length > 0) {
          const now = new Date();
          const currentWeek = weeksList.find((w) => {
            const weekDate = new Date(w.sunday_date);
            return weekDate <= now;
          });
          const weekToSelect = currentWeek || weeksList[weeksList.length - 1];
          onWeekChange(weekToSelect.id);
        }
      } catch (error) {
        console.error('Error fetching weeks:', error);
      }
    }
    loadWeeks();
  }, [selectedWeekId, onWeekChange]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="metallic-card flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white/90 hover:text-white transition-colors min-w-[220px]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 shrink-0">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
        </svg>
        <span className="truncate">{selectedLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`ml-auto shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 right-0 min-w-[280px] metallic-card rounded-lg shadow-2xl max-h-80 overflow-y-auto custom-scrollbar">
            {Object.entries(groupedWeeks).map(([monthKey, monthWeeks]) => (
              <div key={monthKey}>
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-yellow-500/80 bg-white/5 sticky top-0">
                  {monthKey}
                </div>
                {monthWeeks.map((week) => (
                  <button
                    key={week.id}
                    onClick={() => {
                      onWeekChange(week.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      selectedWeekId === week.id
                        ? 'bg-yellow-500/20 text-yellow-300 font-medium'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {week.label}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(groupedWeeks).length === 0 && (
              <div className="px-4 py-6 text-center text-white/50 text-sm">
                No hay semanas disponibles
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
