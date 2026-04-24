import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM academic_years ORDER BY name ASC');
    return NextResponse.json({ years: result.rows });
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

    const { name, start_date, end_date } = await request.json();
    if (!name || !start_date || !end_date) {
      return NextResponse.json({ error: 'Nombre, fecha inicio y fecha fin requeridos' }, { status: 400 });
    }

    const id = `year_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await turso.execute({
      sql: 'INSERT INTO academic_years (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 0)',
      args: [id, name, start_date, end_date],
    });

    // Generate weeks for this year (Sundays from start_date to end_date)
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    let currentDate = new Date(startDate);
    if (currentDate.getDay() !== 0) {
      currentDate.setDate(currentDate.getDate() + (7 - currentDate.getDay()));
    }
    
    let weekNum = 1;
    while (currentDate <= endDate) {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      const sundayDate = currentDate.toISOString().split('T')[0];
      
      const weekId = `week_${id}_${weekNum}`;
      await turso.execute({
        sql: 'INSERT INTO weeks (id, academic_year_id, week_number, month, year, month_name, sunday_date, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [weekId, id, weekNum, month + 1, year, monthNames[month], sundayDate, `Semana ${weekNum} - ${monthNames[month]} ${year}`],
      });
      
      weekNum++;
      currentDate.setDate(currentDate.getDate() + 7);
    }

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

    const { id, name, start_date, end_date, is_active } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const updates: string[] = [];
    const args: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); args.push(name); }
    if (start_date !== undefined) { updates.push('start_date = ?'); args.push(start_date); }
    if (end_date !== undefined) { updates.push('end_date = ?'); args.push(end_date); }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      args.push(is_active ? 1 : 0);
      // If setting as active, deactivate others
      if (is_active) {
        await turso.execute('UPDATE academic_years SET is_active = 0 WHERE id != ?', [id]);
      }
    }

    if (updates.length > 0) {
      args.push(id);
      await turso.execute({
        sql: `UPDATE academic_years SET ${updates.join(', ')} WHERE id = ?`,
        args,
      });
    }

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

    // Delete weeks, grades, and comments for this year
    const weeks = await turso.execute({
      sql: 'SELECT id FROM weeks WHERE academic_year_id = ?',
      args: [id],
    });

    for (const week of weeks.rows) {
      await turso.execute({
        sql: 'DELETE FROM grades WHERE week_id = ?',
        args: [week.id as string],
      });
      await turso.execute({
        sql: 'DELETE FROM general_comments WHERE week_id = ?',
        args: [week.id as string],
      });
    }

    await turso.execute({
      sql: 'DELETE FROM weeks WHERE academic_year_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM academic_years WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
