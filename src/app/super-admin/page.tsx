'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/navbar';
import { getScoreColor } from '@/lib/score-utils';

type Tab = 'estudiantes' | 'familias' | 'criterios' | 'anos' | 'administradores' | 'notas';

interface Family { id: string; name: string; color: string; }
interface Student { id: string; name: string; family_id: string; family_name: string; family_color: string; }
interface CriteriaItem { id: string; name: string; is_active: number; order_index: number; }
interface Year { id: string; name: string; start_date: string; end_date: string; is_active: number; }
interface AdminUser { id: string; username: string; role: string; name: string; criteria_permissions?: { criteria_id: string; can_grade: number; can_comment: number }[]; }
interface Week { id: string; week_number: number; label: string; month: number; year: number; month_name: string; sunday_date: string; academic_year_id: string; }
interface GradeEntry { id: string; student_id: string; criteria_id: string; week_id: string; score: number; comment: string; student_name?: string; criteria_name?: string; }

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('estudiantes');
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Estudiantes form
  const [studentName, setStudentName] = useState('');
  const [studentFamilyId, setStudentFamilyId] = useState('');

  // Familias form
  const [familyName, setFamilyName] = useState('');
  const [familyColor, setFamilyColor] = useState('#D4AF37');

  // Criterios form
  const [criteriaName, setCriteriaName] = useState('');
  const [criteriaActive, setCriteriaActive] = useState(true);

  // Años form
  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');

  // Users form
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('admin');
  const [userCriteriaPermissions, setUserCriteriaPermissions] = useState<Record<string, { can_grade: boolean; can_comment: boolean }>>({});
  const [managingPermissionsFor, setManagingPermissionsFor] = useState<string | null>(null);

  // Grades form
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeComment, setGradeComment] = useState('');
  const [gradeFamilyId, setGradeFamilyId] = useState('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  // Super Admin grades table state
  const [saGradeData, setSaGradeData] = useState<Record<string, { score: string; comment: string; originalScore: string; originalComment: string; modified: boolean }>>({});
  const [saHasChanges, setSaHasChanges] = useState(false);
  const [saSaving, setSaSaving] = useState(false);

  const fetchData = useCallback(async () => {
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
      setCriteriaList(critData.criteria || []);
      setYears(yearData.years || []);

      // Fetch weeks for active year
      const activeYear = (yearData.years || []).find((y: Year) => y.is_active === 1);
      if (activeYear) {
        const weeksRes = await fetch(`/api/weeks?year_id=${activeYear.id}`);
        const weeksData = await weeksRes.json();
        const allWeeks = weeksData.weeks || [];
        // Show all weeks (including future) for super admin
        setWeeks(allWeeks);
        if (allWeeks.length > 0 && !selectedWeekId) {
          // Auto-select the most recent past week (current week)
          const now = new Date();
          now.setHours(23, 59, 59, 999);
          const pastWeeks = allWeeks.filter((w: Week) => new Date(w.sunday_date) <= now);
          const weekToSelect = pastWeeks.length > 0 ? pastWeeks[pastWeeks.length - 1] : allWeeks[0];
          setSelectedWeekId(weekToSelect.id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedWeekId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (gradeFamilyId) {
      setFilteredStudents(students.filter(s => s.family_id === gradeFamilyId));
    } else {
      setFilteredStudents(students);
    }
  }, [gradeFamilyId, students]);

  const fetchGrades = useCallback(async () => {
    if (!selectedWeekId) return;
    try {
      const res = await fetch(`/api/grades?week_id=${selectedWeekId}`);
      const data = await res.json();
      const allGrades: GradeEntry[] = data.grades || [];

      // Build grade data map for table
      const newGradeData: Record<string, { score: string; comment: string; originalScore: string; originalComment: string; modified: boolean }> = {};
      for (const g of allGrades) {
        const key = `${g.student_id}_${g.criteria_id}`;
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
      setSaGradeData(newGradeData);
      setSaHasChanges(false);
      // Also set the old grades for backward compatibility
      setGrades(allGrades);
    } catch {
      // Error
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (selectedWeekId) {
      fetchGrades();
    }
  }, [selectedWeekId, fetchGrades]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch {
      // Not authorized
    }
  }

  function resetForm() {
    setEditingItem(null);
    setShowAddForm(false);
    setStudentName('');
    setStudentFamilyId('');
    setFamilyName('');
    setFamilyColor('#D4AF37');
    setCriteriaName('');
    setCriteriaActive(true);
    setYearName('');
    setYearStartDate('');
    setYearEndDate('');
    setUserUsername('');
    setUserPassword('');
    setUserName('');
    setUserRole('admin');
    setUserCriteriaPermissions({});
    setManagingPermissionsFor(null);
  }

  // CRUD Operations
  async function saveStudent() {
    if (!studentName || !studentFamilyId) return;
    try {
      if (editingItem) {
        await fetch('/api/students', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem, name: studentName, family_id: studentFamilyId }),
        });
      } else {
        await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: studentName, family_id: studentFamilyId }),
        });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving student:', error);
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm('¿Eliminar este estudiante?')) return;
    try {
      await fetch(`/api/students?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  }

  async function saveFamily() {
    if (!familyName) return;
    try {
      if (editingItem) {
        await fetch('/api/families', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem, name: familyName, color: familyColor }),
        });
      } else {
        await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: familyName, color: familyColor }),
        });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving family:', error);
    }
  }

  async function deleteFamily(id: string) {
    if (!confirm('¿Eliminar esta familia y todos sus estudiantes?')) return;
    try {
      await fetch(`/api/families?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting family:', error);
    }
  }

  async function saveCriteria() {
    if (!criteriaName) return;
    try {
      if (editingItem) {
        await fetch('/api/criteria', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem, name: criteriaName, is_active: criteriaActive }),
        });
      } else {
        await fetch('/api/criteria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: criteriaName, is_active: criteriaActive }),
        });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving criteria:', error);
    }
  }

  async function deleteCriteria(id: string) {
    if (!confirm('¿Eliminar este criterio?')) return;
    try {
      await fetch(`/api/criteria?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting criteria:', error);
    }
  }

  async function saveYear() {
    if (!yearName || !yearStartDate || !yearEndDate) return;
    try {
      if (editingItem) {
        await fetch('/api/years', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem, name: yearName, start_date: yearStartDate, end_date: yearEndDate }),
        });
      } else {
        await fetch('/api/years', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: yearName, start_date: yearStartDate, end_date: yearEndDate }),
        });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving year:', error);
    }
  }

  async function deleteYear(id: string) {
    if (!confirm('¿Eliminar este año académico y todas sus semanas y notas?')) return;
    try {
      await fetch(`/api/years?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting year:', error);
    }
  }

  async function setActiveYear(id: string) {
    try {
      await fetch('/api/years', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true }),
      });
      fetchData();
    } catch (error) {
      console.error('Error setting active year:', error);
    }
  }

  async function saveUser() {
    if (!userUsername || !userName || (!editingItem && !userPassword)) return;
    try {
      const criteriaPermissions = userRole === 'admin'
        ? Object.entries(userCriteriaPermissions)
            .filter(([, perms]) => perms.can_grade || perms.can_comment)
            .map(([criteria_id, perms]) => ({
              criteria_id,
              can_grade: perms.can_grade,
              can_comment: perms.can_comment,
            }))
        : [];

      const body: Record<string, unknown> = {
        username: userUsername,
        name: userName,
        role: userRole,
        criteria_permissions: criteriaPermissions,
      };
      if (userPassword) body.password = userPassword;
      if (editingItem) {
        body.id = editingItem;
        await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        body.password = userPassword;
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }

  async function savePermissions(userId: string) {
    const criteriaPermissions = Object.entries(userCriteriaPermissions)
      .filter(([, perms]) => perms.can_grade || perms.can_comment)
      .map(([criteria_id, perms]) => ({
        criteria_id,
        can_grade: perms.can_grade,
        can_comment: perms.can_comment,
      }));

    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          criteria_permissions: criteriaPermissions,
        }),
      });
      setManagingPermissionsFor(null);
      setUserCriteriaPermissions({});
      fetchUsers();
    } catch (error) {
      console.error('Error saving permissions:', error);
    }
  }

  function openPermissionsManager(user: AdminUser) {
    const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
    // Initialize all criteria as unchecked
    for (const crit of criteriaList) {
      perms[crit.id] = { can_grade: false, can_comment: false };
    }
    // Load existing permissions
    if (user.criteria_permissions) {
      for (const p of user.criteria_permissions) {
        perms[p.criteria_id] = {
          can_grade: Number(p.can_grade) === 1,
          can_comment: Number(p.can_comment) === 1,
        };
      }
    }
    setUserCriteriaPermissions(perms);
    setManagingPermissionsFor(user.id);
  }

  async function deleteUser(id: string) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }

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

  async function deleteGrade(criteriaId: string) {
    try {
      await fetch('/api/grades', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          criteria_id: criteriaId,
          week_id: selectedWeekId,
        }),
      });
      fetchGrades();
    } catch (error) {
      console.error('Error deleting grade:', error);
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'estudiantes', label: 'Estudiantes', icon: '👨‍🎓' },
    { key: 'familias', label: 'Familias', icon: '🏠' },
    { key: 'criterios', label: 'Criterios', icon: '📋' },
    { key: 'anos', label: 'Años Académicos', icon: '📅' },
    { key: 'administradores', label: 'Administradores', icon: '👤' },
    { key: 'notas', label: 'Notas', icon: '📝' },
  ];

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

  function saUpdateGradeCell(studentId: string, criteriaId: string, field: 'score' | 'comment', value: string) {
    const key = `${studentId}_${criteriaId}`;
    setSaGradeData(prev => {
      const existing = prev[key] || { score: '', comment: '', originalScore: '', originalComment: '', modified: false };
      const updated = {
        ...existing,
        [field]: value,
        modified: true,
      };
      const newData = { ...prev, [key]: updated };
      const anyModified = Object.values(newData).some(c => c.modified);
      setSaHasChanges(anyModified);
      return newData;
    });
  }

  async function saSaveAllGrades() {
    if (!selectedWeekId) return;
    setSaSaving(true);
    try {
      const modifiedEntries = Object.entries(saGradeData).filter(([, cell]) => cell.modified && cell.score !== '');
      const promises = modifiedEntries.map(([key, cell]) => {
        const lastUnderscoreIdx = key.lastIndexOf('_');
        const studentId = key.substring(0, lastUnderscoreIdx);
        const criteriaId = key.substring(lastUnderscoreIdx + 1);
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
      await fetchGrades();
    } catch (error) {
      console.error('Error saving grades:', error);
    } finally {
      setSaSaving(false);
    }
  }

  function saGetStudentAverage(studentId: string): number {
    const activeCriteria = criteriaList.filter(c => c.is_active === 1);
    const scores: number[] = [];
    for (const crit of activeCriteria) {
      const key = `${studentId}_${crit.id}`;
      const cell = saGradeData[key];
      if (cell && cell.score !== '') {
        scores.push(Number(cell.score));
      }
    }
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 mb-6 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); resetForm(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Estudiantes Tab */}
        {activeTab === 'estudiantes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Estudiantes</h2>
              <button
                onClick={() => { setShowAddForm(true); setEditingItem(null); setStudentName(''); setStudentFamilyId(''); }}
                className="metallic-btn-gold px-4 py-2 rounded-lg text-sm font-bold"
              >
                + Agregar
              </button>
            </div>

            {showAddForm && (
              <div className="metallic-card rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-sm">
                  {editingItem ? 'Editar Estudiante' : 'Nuevo Estudiante'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre del estudiante"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <select
                    value={studentFamilyId}
                    onChange={(e) => setStudentFamilyId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                  >
                    <option value="" className="bg-gray-900">Seleccionar familia</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id} className="bg-gray-900">{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveStudent} className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white">
                    {editingItem ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {students.map((student) => (
                <div key={student.id} className="metallic-card rounded-lg p-3 flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: student.family_color || '#D4AF37' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{student.name}</p>
                    <p className="text-xs text-white/40">{student.family_name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem(student.id);
                      setStudentName(student.name);
                      setStudentFamilyId(student.family_id);
                      setShowAddForm(true);
                    }}
                    className="text-white/40 hover:text-yellow-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => deleteStudent(student.id)}
                    className="text-white/40 hover:text-red-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Familias Tab */}
        {activeTab === 'familias' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Familias</h2>
              <button
                onClick={() => { setShowAddForm(true); setEditingItem(null); setFamilyName(''); setFamilyColor('#D4AF37'); }}
                className="metallic-btn-gold px-4 py-2 rounded-lg text-sm font-bold"
              >
                + Agregar
              </button>
            </div>

            {showAddForm && (
              <div className="metallic-card rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-sm">
                  {editingItem ? 'Editar Familia' : 'Nueva Familia'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre de la familia"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={familyColor}
                      onChange={(e) => setFamilyColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                    <span className="text-sm text-white/60">{familyColor}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveFamily} className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white">
                    {editingItem ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {families.map((family) => (
                <div key={family.id} className="metallic-card rounded-lg p-3 flex items-center gap-3">
                  <div className="w-4 h-10 rounded-full shrink-0" style={{ backgroundColor: family.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{family.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem(family.id);
                      setFamilyName(family.name);
                      setFamilyColor(family.color);
                      setShowAddForm(true);
                    }}
                    className="text-white/40 hover:text-yellow-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => deleteFamily(family.id)}
                    className="text-white/40 hover:text-red-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Criterios Tab */}
        {activeTab === 'criterios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Criterios ({criteriaList.length}/12)</h2>
              {criteriaList.length < 12 && (
                <button
                  onClick={() => { setShowAddForm(true); setEditingItem(null); setCriteriaName(''); setCriteriaActive(true); }}
                  className="metallic-btn-gold px-4 py-2 rounded-lg text-sm font-bold"
                >
                  + Agregar
                </button>
              )}
            </div>

            {showAddForm && (
              <div className="metallic-card rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-sm">
                  {editingItem ? 'Editar Criterio' : 'Nuevo Criterio'}
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Nombre del criterio"
                    value={criteriaName}
                    onChange={(e) => setCriteriaName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={criteriaActive}
                      onChange={(e) => setCriteriaActive(e.target.checked)}
                      className="rounded bg-white/10 border-white/20"
                    />
                    Activo
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveCriteria} className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white">
                    {editingItem ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {criteriaList.map((crit) => (
                <div key={crit.id} className="metallic-card rounded-lg p-3 flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${crit.is_active ? 'bg-green-500' : 'bg-red-500/60'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{crit.name}</p>
                    <p className="text-xs text-white/40">Orden: {crit.order_index}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${crit.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {crit.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    onClick={() => {
                      setEditingItem(crit.id);
                      setCriteriaName(crit.name);
                      setCriteriaActive(crit.is_active === 1);
                      setShowAddForm(true);
                    }}
                    className="text-white/40 hover:text-yellow-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => deleteCriteria(crit.id)}
                    className="text-white/40 hover:text-red-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Años Académicos Tab */}
        {activeTab === 'anos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Años Académicos</h2>
              <button
                onClick={() => { setShowAddForm(true); setEditingItem(null); setYearName(''); setYearStartDate(''); setYearEndDate(''); }}
                className="metallic-btn-gold px-4 py-2 rounded-lg text-sm font-bold"
              >
                + Agregar
              </button>
            </div>

            {showAddForm && (
              <div className="metallic-card rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-sm">
                  {editingItem ? 'Editar Año Académico' : 'Nuevo Año Académico'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre (ej: 2026-2027)"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={yearStartDate}
                    onChange={(e) => setYearStartDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={yearEndDate}
                    onChange={(e) => setYearEndDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveYear} className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white">
                    {editingItem ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {years.map((year) => (
                <div key={year.id} className="metallic-card rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{year.name}</p>
                    <p className="text-xs text-white/40">{year.start_date} → {year.end_date}</p>
                  </div>
                  {year.is_active ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 pulse-glow">
                      Activo
                    </span>
                  ) : (
                    <button
                      onClick={() => setActiveYear(year.id)}
                      className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingItem(year.id);
                      setYearName(year.name);
                      setYearStartDate(year.start_date);
                      setYearEndDate(year.end_date);
                      setShowAddForm(true);
                    }}
                    className="text-white/40 hover:text-yellow-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => deleteYear(year.id)}
                    className="text-white/40 hover:text-red-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Administradores Tab */}
        {activeTab === 'administradores' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Administradores</h2>
              <button
                onClick={() => {
                  setShowAddForm(true); setEditingItem(null); setUserUsername(''); setUserPassword(''); setUserName(''); setUserRole('admin');
                  // Initialize all criteria as unchecked for new admin
                  const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
                  for (const crit of criteriaList) {
                    perms[crit.id] = { can_grade: false, can_comment: false };
                  }
                  setUserCriteriaPermissions(perms);
                }}
                className="metallic-btn-gold px-4 py-2 rounded-lg text-sm font-bold"
              >
                + Agregar
              </button>
            </div>

            {showAddForm && (
              <div className="metallic-card rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-sm">
                  {editingItem ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre de usuario"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder={editingItem ? 'Dejar vacío para no cambiar' : 'Contraseña'}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:border-yellow-500/50 focus:outline-none"
                  />
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
                  >
                    <option value="admin" className="bg-gray-900">Admin</option>
                    <option value="super_admin" className="bg-gray-900">Super Admin</option>
                  </select>
                </div>

                {/* Criteria Permissions for Admin role */}
                {userRole === 'admin' && (
                  <div className="space-y-2 mt-2">
                    <h4 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Permisos de Criterios
                    </h4>
                    <p className="text-xs text-white/40">Selecciona qué criterios puede ver y calificar este administrador.</p>
                    <div className="space-y-1">
                      {criteriaList.filter(c => c.is_active === 1).map((crit) => {
                        const perm = userCriteriaPermissions[crit.id];
                        return (
                          <div key={crit.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                            <label className="flex items-center gap-2 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm?.can_grade || false}
                                onChange={(e) => {
                                  setUserCriteriaPermissions(prev => ({
                                    ...prev,
                                    [crit.id]: {
                                      can_grade: e.target.checked,
                                      can_comment: e.target.checked ? (prev[crit.id]?.can_comment ?? true) : false,
                                    }
                                  }));
                                }}
                                className="rounded bg-white/10 border-white/20 accent-yellow-500"
                              />
                              <span className="text-sm text-white">{crit.name}</span>
                            </label>
                            {perm?.can_grade && (
                              <label className="flex items-center gap-1 text-xs text-white/50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={perm?.can_comment || false}
                                  onChange={(e) => {
                                    setUserCriteriaPermissions(prev => ({
                                      ...prev,
                                      [crit.id]: {
                                        ...prev[crit.id],
                                        can_comment: e.target.checked,
                                      }
                                    }));
                                  }}
                                  className="rounded bg-white/10 border-white/20 accent-blue-400"
                                />
                                Comentar
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Quick actions */}
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
                          for (const crit of criteriaList.filter(c => c.is_active === 1)) {
                            perms[crit.id] = { can_grade: true, can_comment: true };
                          }
                          setUserCriteriaPermissions(perms);
                        }}
                        className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
                          for (const crit of criteriaList.filter(c => c.is_active === 1)) {
                            perms[crit.id] = { can_grade: false, can_comment: false };
                          }
                          setUserCriteriaPermissions(perms);
                        }}
                        className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={saveUser} className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white">
                    {editingItem ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Permissions Manager Panel */}
            {managingPermissionsFor && (
              <div className="metallic-card rounded-xl p-4 space-y-3 border-2 border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-yellow-400 text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Gestionar Permisos de Criterios
                  </h3>
                  <span className="text-sm text-white/60">
                    {users.find(u => u.id === managingPermissionsFor)?.name}
                  </span>
                </div>
                <p className="text-xs text-white/40">Activa los criterios que este administrador puede ver y calificar.</p>
                <div className="space-y-1">
                  {criteriaList.filter(c => c.is_active === 1).map((crit) => {
                    const perm = userCriteriaPermissions[crit.id];
                    return (
                      <div key={crit.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={perm?.can_grade || false}
                            onChange={(e) => {
                              setUserCriteriaPermissions(prev => ({
                                ...prev,
                                [crit.id]: {
                                  can_grade: e.target.checked,
                                  can_comment: e.target.checked ? (prev[crit.id]?.can_comment ?? true) : false,
                                }
                              }));
                            }}
                            className="rounded bg-white/10 border-white/20 accent-yellow-500"
                          />
                          <span className="text-sm text-white">{crit.name}</span>
                        </label>
                        {perm?.can_grade && (
                          <label className="flex items-center gap-1 text-xs text-white/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perm?.can_comment || false}
                              onChange={(e) => {
                                setUserCriteriaPermissions(prev => ({
                                  ...prev,
                                  [crit.id]: {
                                    ...prev[crit.id],
                                    can_comment: e.target.checked,
                                  }
                                }));
                              }}
                              className="rounded bg-white/10 border-white/20 accent-blue-400"
                            />
                            Comentar
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
                      for (const crit of criteriaList.filter(c => c.is_active === 1)) {
                        perms[crit.id] = { can_grade: true, can_comment: true };
                      }
                      setUserCriteriaPermissions(perms);
                    }}
                    className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
                      for (const crit of criteriaList.filter(c => c.is_active === 1)) {
                        perms[crit.id] = { can_grade: false, can_comment: false };
                      }
                      setUserCriteriaPermissions(perms);
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                  >
                    Deseleccionar todos
                  </button>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => savePermissions(managingPermissionsFor)}
                    className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white"
                  >
                    Guardar Permisos
                  </button>
                  <button
                    onClick={() => { setManagingPermissionsFor(null); setUserCriteriaPermissions({}); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {users.map((u) => (
                <div key={u.id} className="metallic-card rounded-lg p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/60 font-bold text-xs shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{u.name}</p>
                    <p className="text-xs text-white/40">@{u.username}</p>
                    {u.role === 'admin' && u.criteria_permissions && u.criteria_permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {u.criteria_permissions.map((p) => {
                          const critName = criteriaList.find(c => c.id === p.criteria_id)?.name;
                          return critName ? (
                            <span key={p.criteria_id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                              {critName}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {u.role === 'admin' && (!u.criteria_permissions || u.criteria_permissions.length === 0) && (
                      <p className="text-[10px] text-red-400/70 mt-0.5">Sin criterios asignados</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${u.role === 'super_admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                  {u.role === 'admin' && (
                    <button
                      onClick={() => openPermissionsManager(u)}
                      className="text-white/40 hover:text-blue-400 transition-colors p-1"
                      title="Gestionar permisos"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingItem(u.id);
                      setUserUsername(u.username);
                      setUserName(u.name);
                      setUserRole(u.role);
                      setUserPassword('');
                      // Load existing permissions for editing
                      if (u.role === 'admin') {
                        const perms: Record<string, { can_grade: boolean; can_comment: boolean }> = {};
                        for (const crit of criteriaList) {
                          const existingPerm = u.criteria_permissions?.find(p => p.criteria_id === crit.id);
                          perms[crit.id] = existingPerm
                            ? { can_grade: Number(existingPerm.can_grade) === 1, can_comment: Number(existingPerm.can_comment) === 1 }
                            : { can_grade: false, can_comment: false };
                        }
                        setUserCriteriaPermissions(perms);
                      }
                      setShowAddForm(true);
                    }}
                    className="text-white/40 hover:text-yellow-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-white/40 hover:text-red-400 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas Tab */}
        {activeTab === 'notas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">📝 Gestión de Notas</h2>
              {saHasChanges && (
                <button
                  onClick={saSaveAllGrades}
                  disabled={saSaving}
                  className="metallic-btn px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {saSaving ? (
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

            <div className="flex flex-wrap items-center gap-3">
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
                onChange={(e) => setGradeFamilyId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-yellow-500/50 focus:outline-none"
              >
                <option value="" className="bg-gray-900">Todas las familias</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id} className="bg-gray-900">{f.name}</option>
                ))}
              </select>
            </div>

            {selectedWeekId && criteriaList.filter(c => c.is_active === 1).length > 0 && (
              <div className="overflow-x-auto metallic-card rounded-xl">
                <table className="text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2.5 text-yellow-500/80 font-bold text-xs uppercase tracking-wider sticky left-0 bg-gray-900/95 z-10">
                        Estudiante
                      </th>
                      {criteriaList.filter(c => c.is_active === 1).map((crit) => (
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
                    {families
                      .filter(f => !gradeFamilyId || f.id === gradeFamilyId)
                      .map((family) => {
                        const familyStudents = filteredStudents.filter(s => s.family_id === family.id);
                        if (familyStudents.length === 0) return null;
                        return (
                          <React.Fragment key={family.id}>
                            <tr className="bg-white/5">
                              <td
                                colSpan={criteriaList.filter(c => c.is_active === 1).length * 2 + 2}
                                className="px-3 py-1.5 font-bold text-xs uppercase tracking-wider sticky left-0 bg-gray-900/95 z-10"
                                style={{ color: family.color || '#D4AF37' }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: family.color || '#D4AF37' }} />
                                  {family.name}
                                </div>
                              </td>
                            </tr>
                            {familyStudents.map((student) => {
                              const avg = saGetStudentAverage(student.id);
                              const avgColor = getScoreColor(avg);
                              const activeCriteria = criteriaList.filter(c => c.is_active === 1);
                              return (
                                <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="px-3 py-1.5 text-white text-sm font-medium sticky left-0 bg-gray-900/90 z-10">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: student.family_color || '#D4AF37' }} />
                                      <span className="whitespace-nowrap">{student.name}</span>
                                    </div>
                                  </td>
                                  {activeCriteria.map((crit) => {
                                    const key = `${student.id}_${crit.id}`;
                                    const cell = saGradeData[key];
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
                                            onChange={(e) => saUpdateGradeCell(student.id, crit.id, 'score', e.target.value)}
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
                                            onChange={(e) => saUpdateGradeCell(student.id, crit.id, 'comment', e.target.value)}
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
              </div>
            )}
            {!selectedWeekId && (
              <div className="metallic-card rounded-xl p-10 text-center">
                <p className="text-white/50">Selecciona una semana para comenzar a calificar</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
