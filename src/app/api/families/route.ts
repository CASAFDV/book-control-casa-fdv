import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM families ORDER BY name ASC');
    return NextResponse.json({ families: result.rows });
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

    const { name, color } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    const id = `fam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await turso.execute({
      sql: 'INSERT INTO families (id, name, color) VALUES (?, ?, ?)',
      args: [id, name, color || '#D4AF37'],
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

    const { id, name, color } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID y nombre requeridos' }, { status: 400 });
    }

    await turso.execute({
      sql: 'UPDATE families SET name = ?, color = ?, updated_at = datetime("now") WHERE id = ?',
      args: [name, color || '#D4AF37', id],
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

    // Delete grades for students in this family first
    const students = await turso.execute({
      sql: 'SELECT id FROM students WHERE family_id = ?',
      args: [id],
    });

    for (const student of students.rows) {
      await turso.execute({
        sql: 'DELETE FROM grades WHERE student_id = ?',
        args: [student.id as string],
      });
      await turso.execute({
        sql: 'DELETE FROM general_comments WHERE student_id = ?',
        args: [student.id as string],
      });
    }

    await turso.execute({
      sql: 'DELETE FROM students WHERE family_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM families WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
