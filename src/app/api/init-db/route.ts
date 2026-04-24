import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/db-init';

export async function GET() {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error: any) {
    console.error('DB init error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
