'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { getScoreColor } from '@/lib/score-utils';

interface Family { id: string; name: string; color: string; }
interface Student { id: string; name: string; family_id: string; family_name: string; family_color: string; }
interface CriteriaItem { id: string; name: string; is_active: number; order_index: number; }
interface Week { id: string; week_number: number; label: string; academic_year_id: string; }
interface GradeEntry { id: string; student_id: string; criteria_id: string; week_id: string; score: number; comment: string; criteria_name?: string; }
interface User { id: string; username: string; role: string; name: string; }
interface Permission { criteria_id: string; criteria_name: string; can_grade: number; can_comment: number; }

function GradeRow({ grade, selectedStudentId, selectedWeekId, onUpdate }: {
  grade: GradeEntry;
  selectedStudentId: string;
  selectedWeekId: string;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editScore, setEditScore] = useState(String(Number(grade.score)));
  const [editComment, setEditComment] = useState(grade.comment || '');
  const score = Number(grade.score);
  const color = getScoreColor(score);

  async function handleUpdate() {
    try {
      await fetch('/api/grades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          criteria_id: grade.criteria_id,
          week_id: selectedWeekId,
          score: Number(editScore),
          comment: editComment,
        }),
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating grade:', error);
    }
  }

  async function handleDelete() {
    try {
      await fetch('/api/grades', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          criteria_id: grade.criteria_id,
          week_id: selectedWeekId,
        }),
      });
      onUpdate();
    } catch (error) {
      console.error('Error deleting grade:', error);
    }
  }

  return (
    <div className="metallic-card rounded-lg p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <p className="font-medium text-white text-sm">{grade.criteria_name}</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={editScore}
                onChange={(e) => setEditScore(e.target.value)}
                className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
              />
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
                onClick={handleUpdate}
                className="px-2 py-1 rounded text-xs bg-green-600/80 text-white hover:bg-green-600"
              >
                Guardar
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-2 py-1 rounded text-xs bg-white/10 text-white/70 hover:bg-white/20"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-white text-sm">{grade.criteria_name}</p>
            {grade.comment && <p className="text-xs text-white/40 italic">{grade.comment}</p>}
          </>
        )}
      </div>
      {!isEditing && (
        <>
          <span
            className="score-badge text-xs"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            {score.toFixed(1)}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-white/40 hover:text-yellow-400 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button
            onClick={handleDelete}
            className="text-white/40 hover:text-red-400 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState<'notas' | 'comentarios'>('notas');
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeComment, setGradeComment] = useState('');
  const [gradeFamilyId, setGradeFamilyId] = useState('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  // General comment
  const [generalCommentText, setGeneralCommentText] = useState('');
  const [currentGeneralComment, setCurrentGeneralComment] = useState('');
  const [commentStudentId, setCommentStudentId] = useState('');
  const [commentWeekId, setCommentWeekId] = useState('');

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user && (data.user.role === 'admin' || data.user.role === 'super_admin')) {
          setUser(data.user);
          // Load criteria permissions for this admin
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
        // Admin: show all weeks but auto-select the current one
        setWeeks(allWeeks);
        if (allWeeks.length > 0) {
          // Auto-select the most recent past week (current week)
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

  useEffect(() => {
    if (gradeFamilyId) {
      setFilteredStudents(students.filter(s => s.family_id === gradeFamilyId));
    } else {
      setFilteredStudents(students);
    }
  }, [gradeFamilyId, students]);

  const fetchGrades = useCallback(async () => {
    if (!selectedWeekId || !selectedStudentId) return;
    try {
      const res = await fetch(`/api/grades?student_id=${selectedStudentId}&week_id=${selectedWeekId}`);
      const data = await res.json();
      setGrades(data.grades || []);
      setCurrentGeneralComment(data.generalComment || '');
    } catch {
      // Error
    }
  }, [selectedWeekId, selectedStudentId]);

  useEffect(() => {
    if (selectedWeekId && selectedStudentId) {
      fetchGrades();
    }
  }, [selectedWeekId, selectedStudentId, fetchGrades]);

  async function saveGrade() {
    if (!selectedStudentId || !selectedCriteriaId || !selectedWeekId) return;
    try {
      await fetch('/api/grades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          criteria_id: selectedCriteriaId,
          week_id: selectedWeekId,
          score: Number(gradeScore),
          comment: gradeComment,
        }),
      });
      setGradeScore('');
      setGradeComment('');
      setSelectedCriteriaId('');
      fetchGrades();
    } catch (error) {
      console.error('Error saving grade:', error);
    }
  }

  async function saveGeneralComment() {
    if (!commentStudentId || !commentWeekId) return;
    try {
      await fetch('/api/grades/general-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: commentStudentId,
          week_id: commentWeekId,
          comment: generalCommentText,
        }),
      });
      setGeneralCommentText('');
      setCommentStudentId('');
      setCommentWeekId('');
    } catch (error) {
      console.error('Error saving comment:', error);
    }
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
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('notas')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'notas'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            📝 Notas
          </button>
          <button
            onClick={() => setActiveTab('comentarios')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'comentarios'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            💬 Comentarios
          </button>
          {user?.role === 'admin' && userPermissions.length === 0 && (
            <span className="text-xs text-red-400/70 self-center ml-2">Sin criterios asignados - contacte al Super Admin</span>
          )}
        </div>

        {/* Notas Tab */}
        {activeTab === 'notas' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Gestión de Notas</h2>

            {/* Selectors */}
            <div className="metallic-card rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  value={gradeFamilyId}
                  onChange={(e) => { setGradeFamilyId(e.target.value); setSelectedStudentId(''); }}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                >
                  <option value="" className="bg-gray-900">Todas las familias</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id} className="bg-gray-900">{f.name}</option>
                  ))}
                </select>

                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                >
                  <option value="" className="bg-gray-900">Seleccionar estudiante</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id} className="bg-gray-900">{s.name} ({s.family_name})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Grade Form */}
            {selectedWeekId && selectedStudentId && (
              <div className="metallic-card rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-sm">Agregar/Editar Nota</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={selectedCriteriaId}
                    onChange={(e) => setSelectedCriteriaId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                  >
                    <option value="" className="bg-gray-900">Seleccionar criterio</option>
                    {(user?.role === 'super_admin' ? criteriaList : criteriaList.filter(c => userPermissions.some(p => p.criteria_id === c.id && Number(p.can_grade) === 1))).map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    placeholder="Nota (0-20)"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Comentario (opcional)"
                    value={gradeComment}
                    onChange={(e) => setGradeComment(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                </div>
                <button
                  onClick={saveGrade}
                  disabled={!selectedCriteriaId || !gradeScore}
                  className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Guardar Nota
                </button>
              </div>
            )}

            {/* Current Grades */}
            {grades.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white/60 uppercase">Notas Actuales</h3>
                {grades
                  .filter(grade => user?.role === 'super_admin' || userPermissions.some(p => p.criteria_id === grade.criteria_id && Number(p.can_grade) === 1))
                  .map((grade) => (
                  <GradeRow
                    key={grade.id}
                    grade={grade}
                    selectedStudentId={selectedStudentId}
                    selectedWeekId={selectedWeekId}
                    onUpdate={fetchGrades}
                  />
                ))}

                {/* General Comment */}
                {currentGeneralComment && (
                  <div className="metallic-card rounded-lg p-3">
                    <p className="text-xs font-bold text-white/60 uppercase mb-1">Comentario General</p>
                    <p className="text-sm text-white/80 italic">{currentGeneralComment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Comentarios Tab */}
        {activeTab === 'comentarios' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Comentarios Generales</h2>

            <div className="metallic-card rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={commentWeekId}
                  onChange={(e) => setCommentWeekId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                >
                  <option value="" className="bg-gray-900">Seleccionar semana</option>
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id} className="bg-gray-900">{w.label}</option>
                  ))}
                </select>

                <select
                  value={commentStudentId}
                  onChange={(e) => setCommentStudentId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none sm:col-span-2"
                >
                  <option value="" className="bg-gray-900">Seleccionar estudiante</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id} className="bg-gray-900">{s.name} ({s.family_name})</option>
                  ))}
                </select>
              </div>

              <textarea
                value={generalCommentText}
                onChange={(e) => setGeneralCommentText(e.target.value)}
                rows={3}
                placeholder="Escribe un comentario general para el estudiante..."
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none resize-none"
              />

              <button
                onClick={saveGeneralComment}
                disabled={!commentStudentId || !commentWeekId || !generalCommentText}
                className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar Comentario
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
