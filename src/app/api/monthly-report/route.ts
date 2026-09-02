import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// GET /api/monthly-report
//    ?available=1                    -> lista de meses/años con semanas registradas
//    ?month=N&year=N                 -> reporte mensual completo (solo super_admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado. Se requiere super admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const wantAvailable = searchParams.get('available') === '1';
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // -------- Available months/years --------
    if (wantAvailable) {
      const result = await turso.execute(
        'SELECT DISTINCT month, year, month_name FROM weeks ORDER BY year ASC, month ASC'
      );
      const available = (result.rows as any[]).map((r) => ({
        month: Number(r.month),
        year: Number(r.year),
        month_name: r.month_name as string,
      }));
      return NextResponse.json({ available });
    }

    // -------- Monthly report --------
    if (!month || !year) {
      return NextResponse.json({ error: 'month y year son requeridos' }, { status: 400 });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    if (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12 || Number.isNaN(yearNum)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // 1) Get weeks for that month/year
    const weeksRes = await turso.execute({
      sql: 'SELECT id, week_number, label, sunday_date FROM weeks WHERE month = ? AND year = ? ORDER BY week_number ASC',
      args: [monthNum, yearNum],
    });
    const weeks = weeksRes.rows as any[];
    const weekIds = weeks.map((w) => w.id as string);

    if (weekIds.length === 0) {
      return NextResponse.json({
        month: monthNum,
        year: yearNum,
        month_name: MONTH_NAMES[monthNum - 1],
        weeks: [],
        families: [],
        top3: [],
        summary: {
          total_families: 0,
          total_students: 0,
          total_grades: 0,
          global_average: 0,
          weeks_count: 0,
        },
      });
    }

    // 2) Get active criteria (for breakdown)
    const criteriaRes = await turso.execute(
      'SELECT id, name, order_index FROM criteria WHERE is_active = 1 ORDER BY order_index ASC'
    );
    const activeCriteria = criteriaRes.rows as any[];
    const criteriaIds = activeCriteria.map((c) => c.id as string);

    // 3) Get all families
    const familiesRes = await turso.execute('SELECT id, name, color FROM families ORDER BY name ASC');
    const families = familiesRes.rows as any[];

    // 4) Get all students (with family_id)
    const studentsRes = await turso.execute('SELECT id, name, family_id FROM students ORDER BY name ASC');
    const allStudents = studentsRes.rows as any[];

    // 5) Get all grades for these weeks (only active criteria)
    let gradesRows: any[] = [];
    if (criteriaIds.length > 0) {
      const placeholders = weekIds.map(() => '?').join(',');
      const critPlaceholders = criteriaIds.map(() => '?').join(',');
      const args = [...weekIds, ...criteriaIds];
      const gradesRes = await turso.execute({
        sql: `SELECT g.student_id, g.criteria_id, g.week_id, g.score
              FROM grades g
              WHERE g.week_id IN (${placeholders}) AND g.criteria_id IN (${critPlaceholders})`,
        args,
      });
      gradesRows = gradesRes.rows as any[];
    }

    // 6) Build maps
    const studentsByFamily = new Map<string, any[]>();
    for (const s of allStudents) {
      const arr = studentsByFamily.get(s.family_id as string) || [];
      arr.push(s);
      studentsByFamily.set(s.family_id as string, arr);
    }

    // 7) Build family-level report
    const familyReports: any[] = [];
    let globalTotalScore = 0;
    let globalTotalPossible = 0;
    let totalGradesCount = 0;

    for (const family of families) {
      const students = studentsByFamily.get(family.id as string) || [];
      const studentIds = students.map((s) => s.id as string);

      let familyScoreSum = 0;
      let familyGradesCount = 0;
      const criteriaTotals: Record<string, { score: number; count: number; possible: number }> = {};
      for (const c of activeCriteria) {
        criteriaTotals[c.id as string] = { score: 0, count: 0, possible: 0 };
      }
      const weekLabels: Record<string, number> = {};
      const studentsWithGrades = new Set<string>();

      for (const g of gradesRows) {
        if (!studentIds.includes(g.student_id as string)) continue;
        familyScoreSum += Number(g.score);
        familyGradesCount++;
        if (criteriaTotals[g.criteria_id as string]) {
          criteriaTotals[g.criteria_id as string].score += Number(g.score);
          criteriaTotals[g.criteria_id as string].count += 1;
          criteriaTotals[g.criteria_id as string].possible += 20;
        }
        if (!weekLabels[g.week_id as string]) weekLabels[g.week_id as string] = 0;
        weekLabels[g.week_id as string] += Number(g.score);
        studentsWithGrades.add(g.student_id as string);
      }

      const familyAvgOutOf20 = familyGradesCount > 0 ? familyScoreSum / familyGradesCount : 0;

      const criteriaBreakdown = activeCriteria.map((c) => {
        const t = criteriaTotals[c.id as string];
        const avg = t.count > 0 ? t.score / t.count : 0;
        return {
          criteria_id: c.id,
          criteria_name: c.name,
          total_score: Math.round(t.score * 100) / 100,
          count: t.count,
          average: Math.round(avg * 100) / 100,
        };
      });

      const weeklyBreakdown = weeks.map((w) => {
        let weekScore = 0;
        let weekCount = 0;
        for (const g of gradesRows) {
          if (g.week_id !== w.id) continue;
          if (!studentIds.includes(g.student_id as string)) continue;
          weekScore += Number(g.score);
          weekCount++;
        }
        const avg = weekCount > 0 ? weekScore / weekCount : 0;
        return {
          week_id: w.id,
          week_number: w.week_number,
          label: w.label,
          sunday_date: w.sunday_date,
          total_score: Math.round(weekScore * 100) / 100,
          count: weekCount,
          average: Math.round(avg * 100) / 100,
        };
      });

      familyReports.push({
        family_id: family.id,
        family_name: family.name,
        family_color: family.color || '#D4AF37',
        student_count: students.length,
        students_with_grades: studentsWithGrades.size,
        grades_count: familyGradesCount,
        total_score: Math.round(familyScoreSum * 100) / 100,
        average: Math.round(familyAvgOutOf20 * 100) / 100,
        criteria_breakdown: criteriaBreakdown,
        weekly_breakdown: weeklyBreakdown,
      });

      globalTotalScore += familyScoreSum;
      globalTotalPossible += familyGradesCount * 20;
      totalGradesCount += familyGradesCount;
    }

    // Sort families by average desc to assign "puestos"
    familyReports.sort((a, b) => b.average - a.average);
    familyReports.forEach((f, i) => {
      f.position = i + 1;
    });

    // Top 3
    const top3 = familyReports.slice(0, 3).map((f) => ({
      position: f.position,
      family_id: f.family_id,
      family_name: f.family_name,
      family_color: f.family_color,
      average: f.average,
      total_score: f.total_score,
      grades_count: f.grades_count,
      student_count: f.student_count,
    }));

    const globalAverage =
      totalGradesCount > 0 ? Math.round((globalTotalScore / totalGradesCount) * 100) / 100 : 0;

    return NextResponse.json({
      month: monthNum,
      year: yearNum,
      month_name: MONTH_NAMES[monthNum - 1],
      weeks: weeks.map((w) => ({
        id: w.id,
        week_number: w.week_number,
        label: w.label,
        sunday_date: w.sunday_date,
      })),
      families: familyReports,
      top3,
      summary: {
        total_families: families.length,
        total_students: allStudents.length,
        total_grades: totalGradesCount,
        global_average: globalAverage,
        weeks_count: weeks.length,
      },
    });
  } catch (error: any) {
    console.error('monthly-report error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
