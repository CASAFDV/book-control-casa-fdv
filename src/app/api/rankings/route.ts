import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('week_id');
    const yearId = searchParams.get('year_id');
    const type = searchParams.get('type'); // 'weekly' or 'monthly'
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Get active criteria
    const criteriaResult = await turso.execute('SELECT * FROM criteria WHERE is_active = 1 ORDER BY order_index ASC');
    const activeCriteria = criteriaResult.rows;
    const criteriaCount = activeCriteria.length;

    if (criteriaCount === 0) {
      return NextResponse.json({ rankings: [], monthlyRanking: [] });
    }

    if (type === 'monthly' && month && year) {
      // Monthly ranking - average of all weeks in the month
      const weeksInMonth = await turso.execute({
        sql: 'SELECT id FROM weeks WHERE month = ? AND year = ?',
        args: [Number(month), Number(year)],
      });

      const weekIds = weeksInMonth.rows.map(r => r.id as string);
      if (weekIds.length === 0) {
        return NextResponse.json({ monthlyRanking: [] });
      }

      const families = await turso.execute('SELECT * FROM families ORDER BY name ASC');
      const rankings: any[] = [];

      for (const family of families.rows) {
        const students = await turso.execute({
          sql: 'SELECT id FROM students WHERE family_id = ?',
          args: [family.id as string],
        });

        let totalScore = 0;
        let totalPossible = 0;

        for (const student of students.rows) {
          for (const weekId of weekIds) {
            const grades = await turso.execute({
              sql: 'SELECT score FROM grades WHERE student_id = ? AND week_id = ? AND criteria_id IN (SELECT id FROM criteria WHERE is_active = 1)',
              args: [student.id as string, weekId],
            });

            for (const grade of grades.rows) {
              totalScore += Number(grade.score);
              totalPossible += 20;
            }
          }
        }

        const average = totalPossible > 0 ? (totalScore / totalPossible) * 20 : 0;
        rankings.push({
          family_id: family.id,
          family_name: family.name,
          family_color: family.color,
          average: Math.round(average * 100) / 100,
          student_count: students.rows.length,
        });
      }

      rankings.sort((a, b) => b.average - a.average);
      return NextResponse.json({ monthlyRanking: rankings });
    }

    if (type === 'weekly' && weekId) {
      // Weekly ranking by families
      const families = await turso.execute('SELECT * FROM families ORDER BY name ASC');
      const rankings: any[] = [];

      for (const family of families.rows) {
        const students = await turso.execute({
          sql: 'SELECT id, name FROM students WHERE family_id = ?',
          args: [family.id as string],
        });

        let familyTotal = 0;
        let familyCount = 0;
        const studentAverages: any[] = [];

        for (const student of students.rows) {
          const grades = await turso.execute({
            sql: `SELECT g.score, g.criteria_id, c.name as criteria_name
                  FROM grades g
                  JOIN criteria c ON g.criteria_id = c.id
                  WHERE g.student_id = ? AND g.week_id = ? AND c.is_active = 1`,
            args: [student.id as string, weekId],
          });

          let studentTotal = 0;
          let studentCriteriaCount = 0;
          const criteriaGrades: any[] = [];

          for (const grade of grades.rows) {
            studentTotal += Number(grade.score);
            studentCriteriaCount++;
            criteriaGrades.push({
              criteria_id: grade.criteria_id,
              criteria_name: grade.criteria_name,
              score: Number(grade.score),
            });
          }

          const studentAvg = studentCriteriaCount > 0 ? studentTotal / studentCriteriaCount : 0;
          studentAverages.push({
            student_id: student.id,
            student_name: student.name,
            average: Math.round(studentAvg * 100) / 100,
            criteria_grades: criteriaGrades,
          });

          if (studentCriteriaCount > 0) {
            familyTotal += studentAvg;
            familyCount++;
          }
        }

        const familyAvg = familyCount > 0 ? familyTotal / familyCount : 0;
        rankings.push({
          family_id: family.id,
          family_name: family.name,
          family_color: family.color,
          average: Math.round(familyAvg * 100) / 100,
          student_count: students.rows.length,
          students: studentAverages,
        });
      }

      rankings.sort((a, b) => b.average - a.average);
      return NextResponse.json({ weeklyRanking: rankings });
    }

    // Default: get active year weekly ranking
    const activeYear = await turso.execute('SELECT * FROM academic_years WHERE is_active = 1 LIMIT 1');
    if (activeYear.rows.length === 0) {
      return NextResponse.json({ rankings: [] });
    }

    // Get the latest week
    const latestWeek = await turso.execute({
      sql: 'SELECT * FROM weeks WHERE academic_year_id = ? ORDER BY week_number DESC LIMIT 1',
      args: [activeYear.rows[0].id as string],
    });

    if (latestWeek.rows.length === 0) {
      return NextResponse.json({ rankings: [] });
    }

    return NextResponse.json({ currentWeekId: latestWeek.rows[0].id });
  } catch (error: any) {
    console.error('Rankings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
