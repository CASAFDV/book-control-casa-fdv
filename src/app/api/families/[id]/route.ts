import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const familyResult = await turso.execute({
      sql: 'SELECT * FROM families WHERE id = ?',
      args: [id],
    });

    if (familyResult.rows.length === 0) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 });
    }

    const studentsResult = await turso.execute({
      sql: 'SELECT * FROM students WHERE family_id = ? ORDER BY name ASC',
      args: [id],
    });

    return NextResponse.json({
      family: familyResult.rows[0],
      students: studentsResult.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
