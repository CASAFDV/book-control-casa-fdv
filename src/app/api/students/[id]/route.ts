import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get student info
    const studentResult = await turso.execute({
      sql: `SELECT s.*, f.name as family_name, f.color as family_color, f.id as family_id
            FROM students s
            JOIN families f ON s.family_id = f.id
            WHERE s.id = ?`,
      args: [id],
    });

    if (studentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
    }

    const student = studentResult.rows[0];

    // Get active criteria
    const criteriaResult = await turso.execute('SELECT * FROM criteria WHERE is_active = 1 ORDER BY order_index ASC');
    const activeCriteria = criteriaResult.rows;

    // Get all grades for this student
    const gradesResult = await turso.execute({
      sql: `SELECT g.*, c.name as criteria_name, c.is_active, c.order_index, w.week_number, w.label as week_label, w.sunday_date
            FROM grades g
            JOIN criteria c ON g.criteria_id = c.id
            JOIN weeks w ON g.week_id = w.id
            WHERE g.student_id = ?
            ORDER BY w.week_number ASC, c.order_index ASC`,
      args: [id],
    });

    // Get general comments
    const commentsResult = await turso.execute({
      sql: `SELECT gc.*, w.week_number, w.label as week_label
            FROM general_comments gc
            JOIN weeks w ON gc.week_id = w.id
            WHERE gc.student_id = ?
            ORDER BY w.week_number ASC`,
      args: [id],
    });

    // Calculate overall average
    const activeGrades = gradesResult.rows.filter(g => g.is_active === 1);
    let totalScore = 0;
    let gradeCount = 0;
    const criteriaScores: Record<string, { total: number; count: number; name: string }> = {};

    for (const grade of activeGrades) {
      const score = Number(grade.score);
      totalScore += score;
      gradeCount++;

      const critId = grade.criteria_id as string;
      if (!criteriaScores[critId]) {
        criteriaScores[critId] = { total: 0, count: 0, name: grade.criteria_name as string };
      }
      criteriaScores[critId].total += score;
      criteriaScores[critId].count++;
    }

    const overallAverage = gradeCount > 0 ? totalScore / gradeCount : 0;

    // Find criteria to improve (lowest average)
    let lowestCriteria: { name: string; average: number } | null = null;
    for (const [critId, data] of Object.entries(criteriaScores)) {
      const avg = data.total / data.count;
      if (!lowestCriteria || avg < lowestCriteria.average) {
        lowestCriteria = { name: data.name, average: Math.round(avg * 100) / 100 };
      }
    }

    return NextResponse.json({
      student,
      grades: gradesResult.rows,
      generalComments: commentsResult.rows,
      activeCriteria,
      overallAverage: Math.round(overallAverage * 100) / 100,
      criteriaScores,
      lowestCriteria,
    });
  } catch (error: any) {
    console.error('Student detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
