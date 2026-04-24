import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearId = searchParams.get('year_id');

    if (yearId) {
      const result = await turso.execute({
        sql: 'SELECT * FROM weeks WHERE academic_year_id = ? ORDER BY week_number ASC',
        args: [yearId],
      });
      return NextResponse.json({ weeks: result.rows });
    }

    // Get all weeks ordered
    const result = await turso.execute(`
      SELECT w.*, ay.name as year_name
      FROM weeks w
      JOIN academic_years ay ON w.academic_year_id = ay.id
      ORDER BY ay.name ASC, w.week_number ASC
    `);
    return NextResponse.json({ weeks: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
