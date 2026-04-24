import { NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Super admin has all permissions
    if (session.role === 'super_admin') {
      const criteriaResult = await turso.execute('SELECT id, name, is_active FROM criteria WHERE is_active = 1 ORDER BY order_index ASC');
      return NextResponse.json({
        permissions: criteriaResult.rows.map((c: any) => ({
          criteria_id: c.id,
          criteria_name: c.name,
          can_grade: 1,
          can_comment: 1,
        })),
      });
    }

    // Regular admin: get their assigned permissions
    const permResult = await turso.execute({
      sql: `
        SELECT acp.criteria_id, c.name as criteria_name, acp.can_grade, acp.can_comment
        FROM admin_criteria_permissions acp
        JOIN criteria c ON acp.criteria_id = c.id
        WHERE acp.user_id = ? AND c.is_active = 1
        ORDER BY c.order_index ASC
      `,
      args: [session.id],
    });

    return NextResponse.json({ permissions: permResult.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
