import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { student_id, week_id, comment } = await request.json();

    if (!student_id || !week_id) {
      return NextResponse.json({ error: 'student_id y week_id requeridos' }, { status: 400 });
    }

    // Check admin permissions for commenting
    if (session.role === 'admin') {
      const permResult = await turso.execute({
        sql: 'SELECT * FROM admin_criteria_permissions WHERE user_id = ? AND can_comment = 1 LIMIT 1',
        args: [session.id],
      });
      if (permResult.rows.length === 0) {
        return NextResponse.json({ error: 'No tiene permiso para comentar' }, { status: 403 });
      }
    }

    const id = `gcomment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await turso.execute({
      sql: `INSERT INTO general_comments (id, student_id, week_id, comment, created_by)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(student_id, week_id)
            DO UPDATE SET comment = ?, updated_at = datetime('now')`,
      args: [id, student_id, week_id, comment || '', session.id, comment || ''],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
