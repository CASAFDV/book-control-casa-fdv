import { NextResponse } from 'next/server';
import turso from '@/lib/turso';
import { formatWeekLabel } from '@/lib/week-utils';

export async function GET() {
  try {
    const result = await turso.execute('SELECT id, sunday_date FROM weeks');
    let updated = 0;

    for (const row of result.rows) {
      const date = new Date(row.sunday_date as string + 'T12:00:00');
      const newLabel = formatWeekLabel(date);

      await turso.execute({
        sql: 'UPDATE weeks SET label = ? WHERE id = ?',
        args: [newLabel, row.id as string],
      });
      updated++;
    }

    return NextResponse.json({ success: true, updated, message: `${updated} semanas actualizadas al nuevo formato` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
