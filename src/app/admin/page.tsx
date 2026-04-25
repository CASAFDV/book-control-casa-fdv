'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { getScoreColor } from '@/lib/score-utils';

interface Family { id: string; name: string; color: string; }
interface Student { id: string; name: string; family_id: string; family_name: string; family_color: string; }
interface CriteriaItem { id: string; name: string; is_active: number; order_index: number; }
interface Week { id: string; week_number: number; label: string; sunday_date: string; academic_year_id: string; }
interface GradeEntry { id: string; student_id: string; criteria_id: string; week_id: string; score: number; comment: string; criteria_name?: string; student_name?: string; family_id?: string; family_name?: string; }
interface User { id: string; username: string; role: string; name: string; }
interface Permission { criteria_id: string; criteria_name: string; can_grade: number; can_comment: number; }

// Grade cell state type
interface GradeCell {
  score: string;
  comment: string;
  originalScore: string;
  originalComment: string;
  modified: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selected week
  const [selectedWeekId, setSelectedWeekId] = useState('');

  // Grade data: { [studentId_criteriaId]: GradeCell }
  const [gradeData, setGradeData] = useState<Record<string, GradeCell>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Filter by family
  const [filterFamilyId, setFilterFamilyId] = useState('');

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user && (data.user.role === 'admin' || data.user.role === 'super_admin')) {
          setUser(data.user);
          if (data.user.role === 'admin') {
            const permRes = await fetch('/api/users/me/permissions');
            const permData = await permRes.json();
            if (permData.permissions) {
              setUserPermissions(permData.permissions);
            }
          }
          await loadInitialData();
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      }
    }
    checkSession();
  }, [router]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [famRes, stuRes, critRes, yearRes] = await Promise.all([
        fetch('/api/families'),
        fetch('/api/students'),
        fetch('/api/criteria'),
        fetch('/api/years'),
      ]);
      const famData = await famRes.json();
      const stuData = await stuRes.json();
      const critData = await critRes.json();
      const yearData = await yearRes.json();

      setFamilies(famData.families || []);
      setStudents(stuData.students || []);
      const activeCriteria = (critData.criteria || []).filter((c: CriteriaItem) => c.is_active === 1);
      setCriteriaList(activeCriteria);

      const activeYear = (yearData.years || []).find((y: { is_active: number }) => y.is_active === 1);
      if (activeYear) {
        const weeksRes = await fetch(`/api/weeks?year_id=${activeYear.id}`);
        const weeksData = await weeksRes.json();
        const allWeeks = weeksData.weeks || [];
        setWeeks(allWeeks);
        if (allWeeks.length > 0) {
          const now = new Date();
          now.setHours(23, 59, 59, 999);
          const pastWeeks = allWeeks.filter((w: { sunday_date: string }) => new Date(w.sunday_date) <= now);
          const weekToSelect = pastWeeks.length > 0 ? pastWeeks[pastWeeks.length - 1] : allWeeks[0];
          setSelectedWeekId(weekToSelect.id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Load grades when week changes
  const fetchAllGrades = useCallback(async () => {
    if (!selectedWeekId) return;
    try {
      const res = await fetch(`/api/grades?week_id=${selectedWeekId}`);
      const data = await res.json();
      const grades: GradeEntry[] = data.grades || [];

      // Build grade data map
      const newGradeData: Record<string, GradeCell> = {};
      for (const g of grades) {
        const key = `${g.student_id}::${g.criteria_id}`;
        const scoreStr = g.score != null ? String(Number(g.score)) : '';
        const commentStr = g.comment || '';
        newGradeData[key] = {
          score: scoreStr,
          comment: commentStr,
          originalScore: scoreStr,
          originalComment: commentStr,
          modified: false,
        };
      }
      setGradeData(newGradeData);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (selectedWeekId) {
      fetchAllGrades();
    }
  }, [selectedWeekId, fetchAllGrades]);

  // Get visible criteria based on permissions
  const visibleCriteria = user?.role === 'admin'
    ? criteriaList.filter(c => userPermissions.some(p => p.criteria_id === c.id && Number(p.can_grade) === 1))
    : criteriaList;

  // Get filtered students
  const filteredStudents = filterFamilyId
    ? students.filter(s => s.family_id === filterFamilyId)
    : students;

  // Group students by family
  const studentsByFamily: Record<string, Student[]> = {};
  for (const s of filteredStudents) {
    if (!studentsByFamily[s.family_id]) {
      studentsByFamily[s.family_id] = [];
    }
    studentsByFamily[s.family_id].push(s);
  }

  // Order families
  const orderedFamilyIds = families
    .filter(f => studentsByFamily[f.id])
    .map(f => f.id);

  function updateGradeCell(studentId: string, criteriaId: string, field: 'score' | 'comment', value: string) {
    const key = `${studentId}::${criteriaId}`;
    setGradeData(prev => {
      const existing = prev[key] || { score: '', comment: '', originalScore: '', originalComment: '', modified: false };
      const updated = {
        ...existing,
        [field]: value,
        modified: true,
      };
      const newData = { ...prev, [key]: updated };
      // Check if any cell is modified
      const anyModified = Object.values(newData).some(c => c.modified);
      setHasChanges(anyModified);
      return newData;
    });
  }

  async function saveAllGrades() {
    if (!selectedWeekId) return;
    setSaving(true);
    try {
      const modifiedKeys = Object.entries(gradeData)
        .filter(([, cell]) => cell.modified && cell.score !== '');

      const promises = modifiedKeys.map(([key, cell]) => {
        const [studentId, criteriaId] = key.split('::');

        return fetch('/api/grades', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            criteria_id: criteriaId,
            week_id: selectedWeekId,
            score: Number(cell.score),
            comment: cell.comment,
          }),
        });
      });

      await Promise.all(promises);
      await fetchAllGrades();
    } catch (error) {
      console.error('Error saving grades:', error);
    } finally {
      setSaving(false);
    }
  }

  function getStudentAverage(studentId: string): number {
    const scores: number[] = [];
    for (const crit of visibleCriteria) {
      const key = `${studentId}::${crit.id}`;
      const cell = gradeData[key];
      if (cell && cell.score !== '') {
        scores.push(Number(cell.score));
      }
    }
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-10 w-10 text-yellow-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-bold text-white">📝 Gestión de Notas</h2>
          {user?.role === 'admin' && userPermissions.length === 0 && (
            <span className="text-xs text-red-400/70">Sin criterios asignados - contacte al Super Admin</span>
          )}
        </div>

        {/* Selectors Row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={selectedWeekId}
            onChange={(e) => setSelectedWeekId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
          >
            <option value="" className="bg-gray-900">Seleccionar semana</option>
            {weeks.map((w) => (
              <option key={w.id} value={w.id} className="bg-gray-900">{w.label}</option>
            ))}
          </select>

          <select
            value={filterFamilyId}
            onChange={(e) => setFilterFamilyId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
          >
            <option value="" className="bg-gray-900">Todas las familias</option>
            {families.map((f) => (
              <option key={f.id} value={f.id} className="bg-gray-900">{f.name}</option>
            ))}
          </select>

          {hasChanges && (
            <button
              onClick={saveAllGrades}
              disabled={saving}
              className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>💾 Guardar Todo</>
              )}
            </button>
          )}
        </div>

        {/* Grade Table */}
        {selectedWeekId && visibleCriteria.length > 0 && (
          <div className="overflow-x-auto metallic-card rounded-xl">
            <table className="text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-3 py-2.5 text-yellow-500/80 font-bold text-xs uppercase tracking-wider sticky left-0 bg-gray-900/95 z-10">
                    Estudiante
                  </th>
                  {visibleCriteria.map((crit) => (
                    <React.Fragment key={`frag_${crit.id}`}>
                      <th className="text-center px-1 py-2.5 min-w-[80px]">
                        <div className="text-yellow-500/80 font-bold text-[11px] uppercase tracking-wider">{crit.name}</div>
                        <div className="text-white/30 text-[10px]">Nota</div>
                      </th>
                      <th className="text-center px-1 py-2.5 min-w-[100px]">
                        <div className="text-blue-400/60 font-bold text-[10px] uppercase tracking-wider">{crit.name}</div>
                        <div className="text-white/30 text-[10px]">Coment.</div>
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="text-center px-3 py-2.5 text-yellow-500/80 font-bold text-xs uppercase tracking-wider min-w-[70px]">
                    Prom.
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedFamilyIds.map((familyId) => {
                  const family = families.find(f => f.id === familyId);
                  const familyStudents = studentsByFamily[familyId] || [];
                  return (
                    <React.Fragment key={familyId}>
                      {/* Family header row */}
                      <tr className="bg-white/5">
                        <td
                          colSpan={visibleCriteria.length * 2 + 2}
                          className="px-3 py-1.5 font-bold text-xs uppercase tracking-wider sticky left-0 bg-gray-900/95 z-10"
                          style={{ color: family?.color || '#D4AF37' }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: family?.color || '#D4AF37' }} />
                            {family?.name}
                          </div>
                        </td>
                      </tr>
                      {/* Student rows */}
                      {familyStudents.map((student) => {
                        const avg = getStudentAverage(student.id);
                        const avgColor = getScoreColor(avg);
                        return (
                          <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-1.5 text-white text-sm font-medium sticky left-0 bg-gray-900/90 z-10">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: student.family_color || '#D4AF37' }} />
                                <span className="whitespace-nowrap">{student.name}</span>
                              </div>
                            </td>
                            {visibleCriteria.map((crit) => {
                              const key = `${student.id}::${crit.id}`;
                              const cell = gradeData[key];
                              const score = cell?.score || '';
                              const scoreNum = Number(score);
                              const hasScore = score !== '' && !isNaN(scoreNum);
                              const cellColor = hasScore ? getScoreColor(scoreNum) : '';
                              return (
                                <React.Fragment key={`frag_${crit.id}`}>
                                  <td className="px-1 py-1 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      step="0.1"
                                      value={score}
                                      onChange={(e) => updateGradeCell(student.id, crit.id, 'score', e.target.value)}
                                      className="w-full max-w-[70px] px-2 py-1.5 rounded text-center text-sm font-medium focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-colors"
                                      style={{
                                        backgroundColor: hasScore ? `${cellColor}20` : 'rgba(255,255,255,0.05)',
                                        color: hasScore ? cellColor : 'rgba(255,255,255,0.3)',
                                        border: cell?.modified ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                      }}
                                      placeholder="—"
                                    />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input
                                      type="text"
                                      value={cell?.comment || ''}
                                      onChange={(e) => updateGradeCell(student.id, crit.id, 'comment', e.target.value)}
                                      placeholder="..."
                                      className="w-full max-w-[100px] px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                                      style={{
                                        backgroundColor: cell?.comment ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                                        color: cell?.comment ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                                        border: cell?.modified ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                      }}
                                    />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            <td className="px-2 py-1 text-center">
                              {avg > 0 ? (
                                <span
                                  className="inline-block px-2 py-1 rounded text-xs font-bold"
                                  style={{ backgroundColor: `${avgColor}25`, color: avgColor }}
                                >
                                  {avg.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-white/20 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {orderedFamilyIds.length === 0 && (
              <div className="px-6 py-10 text-center text-white/50">
                No hay estudiantes registrados
              </div>
            )}
          </div>
        )}

        {!selectedWeekId && (
          <div className="metallic-card rounded-xl p-10 text-center">
            <p className="text-white/50">Selecciona una semana para comenzar a calificar</p>
          </div>
        )}

        {selectedWeekId && visibleCriteria.length === 0 && (
          <div className="metallic-card rounded-xl p-10 text-center">
            <p className="text-red-400/70">No tienes criterios asignados. Contacta al Super Admin.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// Need React import for React.Fragment
import React from 'react';
