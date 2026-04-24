import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('week_id');
    const studentId = searchParams.get('student_id');
    const familyId = searchParams.get('family_id');

    if (studentId && weekId) {
      // Get grades for a specific student and week
      const result = await turso.execute({
        sql: `
          SELECT g.*, c.name as criteria_name, c.is_active, c.order_index
          FROM grades g
          JOIN criteria c ON g.criteria_id = c.id
          WHERE g.student_id = ? AND g.week_id = ?
          ORDER BY c.order_index ASC
        `,
        args: [studentId, weekId],
      });

      // Get general comment
      const commentResult = await turso.execute({
        sql: 'SELECT * FROM general_comments WHERE student_id = ? AND week_id = ?',
        args: [studentId, weekId],
      });

      return NextResponse.json({
        grades: result.rows,
        generalComment: commentResult.rows[0]?.comment || '',
      });
    }

    if (familyId && weekId) {
      // Get grades for all students in a family for a specific week
      const result = await turso.execute({
        sql: `
          SELECT g.*, s.name as student_name, s.id as student_id, c.name as criteria_name, c.is_active, c.order_index
          FROM grades g
          JOIN students s ON g.student_id = s.id
          JOIN criteria c ON g.criteria_id = c.id
          WHERE s.family_id = ? AND g.week_id = ?
          ORDER BY s.name ASC, c.order_index ASC
        `,
        args: [familyId, weekId],
      });
      return NextResponse.json({ grades: result.rows });
    }

    if (weekId) {
      // Get all grades for a specific week
      const result = await turso.execute({
        sql: `
          SELECT g.*, s.name as student_name, s.id as student_id, s.family_id,
                 f.name as family_name, c.name as criteria_name, c.is_active, c.order_index
          FROM grades g
          JOIN students s ON g.student_id = s.id
          JOIN families f ON s.family_id = f.id
          JOIN criteria c ON g.criteria_id = c.id
          WHERE g.week_id = ?
          ORDER BY f.name ASC, s.name ASC, c.order_index ASC
        `,
        args: [weekId],
      });
      return NextResponse.json({ grades: result.rows });
    }

    return NextResponse.json({ error: 'week_id es requerido' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { student_id, criteria_id, week_id, score, comment } = await request.json();

    if (!student_id || !criteria_id || !week_id) {
      return NextResponse.json({ error: 'student_id, criteria_id y week_id requeridos' }, { status: 400 });
    }

    // Check admin permissions
    if (session.role === 'admin') {
      const permResult = await turso.execute({
        sql: 'SELECT * FROM admin_criteria_permissions WHERE user_id = ? AND criteria_id = ? AND can_grade = 1',
        args: [session.id, criteria_id],
      });
      if (permResult.rows.length === 0) {
        return NextResponse.json({ error: 'No tiene permiso para calificar este criterio' }, { status: 403 });
      }
    }

    const id = `grade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await turso.execute({
      sql: `INSERT INTO grades (id, student_id, criteria_id, week_id, score, comment)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, criteria_id, week_id)
            DO UPDATE SET score = ?, comment = ?, updated_at = datetime('now')`,
      args: [id, student_id, criteria_id, week_id, score ?? 0, comment ?? '', score ?? 0, comment ?? ''],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { student_id, criteria_id, week_id, score, comment } = await request.json();

    if (!student_id || !criteria_id || !week_id) {
      return NextResponse.json({ error: 'student_id, criteria_id y week_id requeridos' }, { status: 400 });
    }

    // Check admin permissions
    if (session.role === 'admin') {
      const permResult = await turso.execute({
        sql: 'SELECT * FROM admin_criteria_permissions WHERE user_id = ? AND criteria_id = ? AND can_grade = 1',
        args: [session.id, criteria_id],
      });
      if (permResult.rows.length === 0) {
        return NextResponse.json({ error: 'No tiene permiso para modificar este criterio' }, { status: 403 });
      }
    }

    await turso.execute({
      sql: `INSERT INTO grades (id, student_id, criteria_id, week_id, score, comment)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, criteria_id, week_id)
            DO UPDATE SET score = ?, comment = ?, updated_at = datetime('now')`,
      args: [
        `grade_${student_id}_${criteria_id}_${week_id}`, student_id, criteria_id, week_id, score ?? 0, comment ?? '',
        score ?? 0, comment ?? '',
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { student_id, criteria_id, week_id } = await request.json();

    if (session.role === 'admin') {
      const permResult = await turso.execute({
        sql: 'SELECT * FROM admin_criteria_permissions WHERE user_id = ? AND criteria_id = ?',
        args: [session.id, criteria_id],
      });
      if (permResult.rows.length === 0) {
        return NextResponse.json({ error: 'No tiene permiso' }, { status: 403 });
      }
    }

    if (student_id && criteria_id && week_id) {
      await turso.execute({
        sql: 'DELETE FROM grades WHERE student_id = ? AND criteria_id = ? AND week_id = ?',
        args: [student_id, criteria_id, week_id],
      });
    } else if (student_id && week_id) {
      await turso.execute({
        sql: 'DELETE FROM grades WHERE student_id = ? AND week_id = ?',
        args: [student_id, week_id],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
