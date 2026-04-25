'use client';

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/header';
import { WeekSelector } from '@/components/week-selector';
import { getScoreColor, getScoreLabel } from '@/lib/score-utils';

interface Family {
  id: string;
  name: string;
  color: string;
}

interface Student {
  id: string;
  name: string;
  family_id: string;
}

interface StudentGrade {
  student_id: string;
  student_name: string;
  score: number;
  criteria_count: number;
}

export default function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [family, setFamily] = useState<Family | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFamily();
  }, [id]);

  useEffect(() => {
    if (selectedWeekId && id) {
      fetchGrades();
    }
  }, [selectedWeekId, id]);

  async function fetchFamily() {
    try {
      const res = await fetch(`/api/families/${id}`);
      const data = await res.json();
      if (data.family) {
        setFamily(data.family as Family);
        setStudents(data.students as Student[]);
      }
    } catch (error) {
      console.error('Error fetching family:', error);
    }
  }

  async function fetchGrades() {
    setLoading(true);
    try {
      const res = await fetch(`/api/grades?family_id=${id}&week_id=${selectedWeekId}`);
      const data = await res.json();
      const grades = data.grades || [];

      // Calculate averages per student
      const studentMap: Record<string, { name: string; total: number; count: number }> = {};
      for (const grade of grades) {
        const sid = grade.student_id as string;
        if (!studentMap[sid]) {
          studentMap[sid] = { name: grade.student_name as string, total: 0, count: 0 };
        }
        studentMap[sid].total += Number(grade.score);
        studentMap[sid].count++;
      }

      const gradeList: StudentGrade[] = Object.entries(studentMap).map(([studentId, data]) => ({
        student_id: studentId,
        student_name: data.name,
        score: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
        criteria_count: data.count,
      }));

      setStudentGrades(gradeList);
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header showBackButton backHref="/" />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Family Title */}
        <div className="flex items-center gap-4">
          {family && (
            <div
              className="w-4 h-12 rounded-full shrink-0"
              style={{ backgroundColor: family.color || '#D4AF37' }}
            />
          )}
          <div>
            <h1 className="text-2xl font-black text-white">
              {family?.name || 'Familia'}
            </h1>
            <p className="text-sm text-white/50">
              {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'}
            </p>
          </div>
        </div>

        {/* Week Selector */}
        <WeekSelector
          selectedWeekId={selectedWeekId}
          onWeekChange={setSelectedWeekId}
        />

        {/* Students List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-yellow-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((student) => {
              const grade = studentGrades.find(g => g.student_id === student.id);
              const avg = grade?.score || 0;
              const color = getScoreColor(avg);

              return (
                <a
                  key={student.id}
                  href={`/estudiante/${student.id}`}
                  className="metallic-card rounded-xl p-4 flex items-center gap-4 hover:bg-white/5 transition-all group animate-fade-in-up cursor-pointer"
                >
                  {/* Student avatar */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white/70 font-bold text-sm shrink-0">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Student info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                      {student.name}
                    </h3>
                    <p className="text-xs text-white/40">
                      {grade?.criteria_count || 0} criterios evaluados
                    </p>
                  </div>
                  {/* Average score */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="score-badge"
                      style={{
                        backgroundColor: color,
                        color: '#fff',
                        boxShadow: `0 0 12px ${color}33`,
                      }}
                    >
                      {avg > 0 ? avg.toFixed(1) : '-'}
                    </span>
                    {avg > 0 && (
                      <span className="text-xs text-white/40 hidden sm:inline">
                        {getScoreLabel(avg)}
                      </span>
                    )}
                  </div>
                  {/* Arrow */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 group-hover:text-yellow-400 transition-colors shrink-0">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </a>
              );
            })}
            {students.length === 0 && (
              <div className="metallic-card rounded-xl p-8 text-center">
                <p className="text-white/50">No hay estudiantes en esta familia</p>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="mt-auto py-4 text-center text-white/30 text-xs border-t border-white/5">
        LIBRO CONTROL CASA FDV &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
