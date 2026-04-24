'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { Header } from '@/components/header';
import { WeekSelector } from '@/components/week-selector';
import { ScoreWheel, MiniScoreIndicator } from '@/components/score-wheel';
import { getScoreColor, getScoreLabel } from '@/lib/score-utils';

interface Student {
  id: string;
  name: string;
  family_id: string;
  family_name: string;
  family_color: string;
}

interface Grade {
  id: string;
  student_id: string;
  criteria_id: string;
  week_id: string;
  score: number;
  comment: string;
  criteria_name: string;
  is_active: number;
  order_index: number;
}

interface Criteria {
  id: string;
  name: string;
  is_active: number;
  order_index: number;
}

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
}

interface Permission {
  criteria_id: string;
  criteria_name: string;
  can_grade: number;
  can_comment: number;
}

export default function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [generalComment, setGeneralComment] = useState('');
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editingGeneralComment, setEditingGeneralComment] = useState(false);
  const [editGeneralComment, setEditGeneralComment] = useState('');
  const [overallAverage, setOverallAverage] = useState(0);
  const [lowestCriteria, setLowestCriteria] = useState<{ name: string; average: number } | null>(null);

  useEffect(() => {
    fetchSession();
    fetchStudent();
  }, [id]);

  useEffect(() => {
    if (selectedWeekId) {
      fetchGrades();
    }
  }, [selectedWeekId, id]);

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        // Load criteria permissions for admin users
        if (data.user.role === 'admin') {
          const permRes = await fetch('/api/users/me/permissions');
          const permData = await permRes.json();
          if (permData.permissions) {
            setUserPermissions(permData.permissions);
          }
        }
      }
    } catch {
      // Not logged in
    }
  }

  async function fetchStudent() {
    try {
      const res = await fetch(`/api/students/${id}`);
      const data = await res.json();
      if (data.student) {
        setStudent({
          id: data.student.id,
          name: data.student.name,
          family_id: data.student.family_id,
          family_name: data.student.family_name,
          family_color: data.student.family_color,
        });
      }
      if (data.activeCriteria) {
        setCriteria(data.activeCriteria);
      }
      if (data.overallAverage !== undefined) {
        setOverallAverage(data.overallAverage);
      }
      if (data.lowestCriteria) {
        setLowestCriteria(data.lowestCriteria);
      }
    } catch (error) {
      console.error('Error fetching student:', error);
    }
  }

  const fetchGrades = useCallback(async () => {
    if (!selectedWeekId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/grades?student_id=${id}&week_id=${selectedWeekId}`);
      const data = await res.json();
      setGrades(data.grades || []);
      setGeneralComment(data.generalComment || '');
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
    }
  }, [id, selectedWeekId]);

  function getWeeklyAverage() {
    const activeGrades = grades.filter(g => g.is_active === 1);
    if (activeGrades.length === 0) return 0;
    const total = activeGrades.reduce((sum, g) => sum + Number(g.score), 0);
    return Math.round((total / activeGrades.length) * 100) / 100;
  }

  function findLowestCriteria() {
    const activeGrades = grades.filter(g => g.is_active === 1);
    if (activeGrades.length === 0) return null;
    let lowest = activeGrades[0];
    for (const grade of activeGrades) {
      if (Number(grade.score) < Number(lowest.score)) {
        lowest = grade;
      }
    }
    return { name: lowest.criteria_name, score: Number(lowest.score) };
  }

  async function saveGrade(criteriaId: string, score: number, comment: string) {
    try {
      await fetch('/api/grades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: id,
          criteria_id: criteriaId,
          week_id: selectedWeekId,
          score,
          comment,
        }),
      });
      setEditingGrade(null);
      fetchGrades();
    } catch (error) {
      console.error('Error saving grade:', error);
    }
  }

  async function saveGeneralComment() {
    try {
      await fetch('/api/grades/general-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: id,
          week_id: selectedWeekId,
          comment: editGeneralComment,
        }),
      });
      setEditingGeneralComment(false);
      setGeneralComment(editGeneralComment);
    } catch (error) {
      console.error('Error saving comment:', error);
    }
  }

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  // Check if admin can grade a specific criteria
  const canGradeCriteria = (criteriaId: string) => {
    if (!user) return false; // No logged-in user = no edit
    if (user.role === 'super_admin') return true;
    if (user.role === 'admin') {
      return userPermissions.some(p => p.criteria_id === criteriaId && Number(p.can_grade) === 1);
    }
    return false;
  };
  // Check if admin can comment
  const canCommentGeneral = !!user && (user.role === 'super_admin' || userPermissions.some(p => Number(p.can_comment) === 1));
  // Filter criteria for admin - only show criteria they can grade; visitors see all
  const visibleCriteria = user?.role === 'admin'
    ? criteria.filter(c => userPermissions.some(p => p.criteria_id === c.id && Number(p.can_grade) === 1))
    : criteria;
  const weeklyAvg = getWeeklyAverage();
  const lowest = findLowestCriteria();

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        showBackButton
        backHref={student ? `/familia/${student.family_id}` : '/'}
      />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Student Title */}
        <div className="flex items-center gap-4">
          {student && (
            <div
              className="w-4 h-12 rounded-full shrink-0"
              style={{ backgroundColor: student.family_color || '#D4AF37' }}
            />
          )}
          <div>
            <h1 className="text-2xl font-black text-white">
              {student?.name || 'Estudiante'}
            </h1>
            <p className="text-sm text-white/50">
              {student?.family_name || 'Familia'}
            </p>
          </div>
        </div>

        {/* Week Selector */}
        <WeekSelector
          selectedWeekId={selectedWeekId}
          onWeekChange={setSelectedWeekId}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-yellow-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : (
          <>
            {/* Score Wheel */}
            <div className="metallic-card rounded-xl p-6 flex flex-col items-center gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500/80">
                Promedio Semanal
              </h3>
              <ScoreWheel
                score={weeklyAvg}
                maxScore={20}
                size={180}
                label="de 20"
              />
              <p className="text-sm" style={{ color: getScoreColor(weeklyAvg) }}>
                {weeklyAvg > 0 ? getScoreLabel(weeklyAvg) : 'Sin datos'}
              </p>
            </div>

            {/* Criteria Grades */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500/80">
                Criterios Evaluados
              </h3>
              {visibleCriteria.length === 0 ? (
                <div className="metallic-card rounded-xl p-6 text-center">
                  <p className="text-white/50">{user?.role === 'admin' ? 'No tienes criterios asignados - contacta al Super Admin' : 'No hay criterios activos'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleCriteria.map((crit) => {
                    const grade = grades.find(g => g.criteria_id === crit.id);
                    const score = grade ? Number(grade.score) : 0;
                    const comment = grade?.comment || '';
                    const color = getScoreColor(score);
                    const isEditing = editingGrade === crit.id;

                    return (
                      <div
                        key={crit.id}
                        className="metallic-card rounded-xl p-4 animate-fade-in-up"
                      >
                        <div className="flex items-center gap-3">
                          <MiniScoreIndicator score={score} size={40} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-white text-sm">{crit.name}</h4>
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-white/50 w-12">Nota:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value={editScore}
                                    onChange={(e) => setEditScore(e.target.value)}
                                    className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                                  />
                                  <span className="text-xs text-white/40">/ 20</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-white/50 w-12">Nota:</label>
                                  <input
                                    type="text"
                                    value={editComment}
                                    onChange={(e) => setEditComment(e.target.value)}
                                    placeholder="Comentario..."
                                    className="flex-1 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveGrade(crit.id, Number(editScore), editComment)}
                                    className="px-3 py-1 rounded text-xs font-medium bg-green-600/80 text-white hover:bg-green-600 transition-colors"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingGrade(null)}
                                    className="px-3 py-1 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className="score-badge text-xs"
                                    style={{
                                      backgroundColor: color,
                                      color: '#fff',
                                      boxShadow: `0 0 8px ${color}33`,
                                    }}
                                  >
                                    {grade ? score.toFixed(1) : '-'}
                                  </span>
                                  {grade && (
                                    <span className="text-xs" style={{ color }}>
                                      {getScoreLabel(score)}
                                    </span>
                                  )}
                                  {canGradeCriteria(crit.id) && (
                                    <button
                                      onClick={() => {
                                        setEditingGrade(crit.id);
                                        setEditScore(grade ? String(score) : '0');
                                        setEditComment(comment);
                                      }}
                                      className="ml-auto text-white/30 hover:text-yellow-400 transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                        <path d="m15 5 4 4"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                {comment && (
                                  <p className="text-xs text-white/50 mt-1 italic">
                                    {comment}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* General Comment */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500/80">
                Comentario General
              </h3>
              <div className="metallic-card rounded-xl p-4">
                {editingGeneralComment ? (
                  <div className="space-y-3">
                    <textarea
                      value={editGeneralComment}
                      onChange={(e) => setEditGeneralComment(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none resize-none"
                      placeholder="Escribe un comentario general..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveGeneralComment}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-green-600/80 text-white hover:bg-green-600 transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingGeneralComment(false)}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      {generalComment ? (
                        <p className="text-white/80 text-sm italic">{generalComment}</p>
                      ) : (
                        <p className="text-white/40 text-sm">Sin comentario general</p>
                      )}
                    </div>
                    {canCommentGeneral && (
                      <button
                        onClick={() => {
                          setEditingGeneralComment(true);
                          setEditGeneralComment(generalComment);
                        }}
                        className="text-white/30 hover:text-yellow-400 transition-colors shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                          <path d="m15 5 4 4"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Criterio a mejorar */}
            {(lowest || lowestCriteria) && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500/80">
                  Criterio a Mejorar
                </h3>
                <div className="metallic-card rounded-xl p-4 border-red-500/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v4"/>
                        <path d="m7 17 5-5 5 5"/>
                        <path d="M7 8 5.5 6.5"/>
                        <path d="M17 8 18.5 6.5"/>
                        <path d="M7 12H2"/>
                        <path d="M22 12h-5"/>
                        <circle cx="12" cy="17" r="5"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-sm">
                        {lowest?.name || lowestCriteria?.name || 'N/A'}
                      </h4>
                      <p className="text-xs text-white/50">
                        Promedio más bajo: {(lowest?.score || lowestCriteria?.average || 0).toFixed(1)} / 20
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Enfócate en mejorar este criterio para subir tu promedio general.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="mt-auto py-4 text-center text-white/30 text-xs border-t border-white/5">
        BOOK CONTROL CASA FDV &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
