import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM criteria ORDER BY order_index ASC');
    return NextResponse.json({ criteria: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { name, is_active } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    // Check max 12 criteria
    const countResult = await turso.execute('SELECT COUNT(*) as count FROM criteria');
    if (Number(countResult.rows[0].count) >= 12) {
      return NextResponse.json({ error: 'Máximo 12 criterios permitidos' }, { status: 400 });
    }

    // Get max order_index
    const maxOrder = await turso.execute('SELECT MAX(order_index) as max_order FROM criteria');
    const nextOrder = (Number(maxOrder.rows[0].max_order) || 0) + 1;

    const id = `crit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await turso.execute({
      sql: 'INSERT INTO criteria (id, name, is_active, order_index) VALUES (?, ?, ?, ?)',
      args: [id, name, is_active !== undefined ? (is_active ? 1 : 0) : 1, nextOrder],
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id, name, is_active, order_index } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const updates: string[] = [];
    const args: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      args.push(name);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      args.push(is_active ? 1 : 0);
    }
    if (order_index !== undefined) {
      updates.push('order_index = ?');
      args.push(order_index);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    args.push(id);
    await turso.execute({
      sql: `UPDATE criteria SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await turso.execute({
      sql: 'DELETE FROM grades WHERE criteria_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM admin_criteria_permissions WHERE criteria_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM criteria WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
