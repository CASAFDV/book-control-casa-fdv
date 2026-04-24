import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const result = await turso.execute(`
      SELECT s.*, f.name as family_name, f.color as family_color
      FROM students s
      JOIN families f ON s.family_id = f.id
      ORDER BY f.name ASC, s.name ASC
    `);
    return NextResponse.json({ students: result.rows });
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

    const { name, family_id } = await request.json();
    if (!name || !family_id) {
      return NextResponse.json({ error: 'Nombre y familia requeridos' }, { status: 400 });
    }

    const id = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await turso.execute({
      sql: 'INSERT INTO students (id, name, family_id) VALUES (?, ?, ?)',
      args: [id, name, family_id],
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

    const { id, name, family_id } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID y nombre requeridos' }, { status: 400 });
    }

    await turso.execute({
      sql: 'UPDATE students SET name = ?, family_id = ?, updated_at = datetime("now") WHERE id = ?',
      args: [name, family_id || null, id],
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
      sql: 'DELETE FROM grades WHERE student_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM general_comments WHERE student_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM students WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
