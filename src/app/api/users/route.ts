import { NextRequest, NextResponse } from 'next/server';
import turso from '@/lib/turso';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const result = await turso.execute('SELECT id, username, role, name, created_at FROM users ORDER BY role ASC, name ASC');
    return NextResponse.json({ users: result.rows });
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

    const { username, password, name, role, criteria_permissions } = await request.json();
    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await turso.execute({
      sql: 'INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)',
      args: [id, username, hashedPassword, role, name],
    });

    // Set criteria permissions for admin
    if (role === 'admin' && criteria_permissions && Array.isArray(criteria_permissions)) {
      for (const perm of criteria_permissions) {
        const permId = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await turso.execute({
          sql: 'INSERT INTO admin_criteria_permissions (id, user_id, criteria_id, can_grade, can_comment) VALUES (?, ?, ?, ?, ?)',
          args: [permId, id, perm.criteria_id, perm.can_grade ? 1 : 0, perm.can_comment ? 1 : 0],
        });
      }
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

    const { id, username, password, name, role, criteria_permissions } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await turso.execute({
        sql: 'UPDATE users SET username = ?, password = ?, role = ?, name = ?, updated_at = datetime("now") WHERE id = ?',
        args: [username, hashedPassword, role, name, id],
      });
    } else {
      await turso.execute({
        sql: 'UPDATE users SET username = ?, role = ?, name = ?, updated_at = datetime("now") WHERE id = ?',
        args: [username, role, name, id],
      });
    }

    // Update criteria permissions
    if (criteria_permissions && Array.isArray(criteria_permissions)) {
      await turso.execute({
        sql: 'DELETE FROM admin_criteria_permissions WHERE user_id = ?',
        args: [id],
      });
      for (const perm of criteria_permissions) {
        const permId = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await turso.execute({
          sql: 'INSERT INTO admin_criteria_permissions (id, user_id, criteria_id, can_grade, can_comment) VALUES (?, ?, ?, ?, ?)',
          args: [permId, id, perm.criteria_id, perm.can_grade ? 1 : 0, perm.can_comment ? 1 : 0],
        });
      }
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

    // Don't allow deleting the last super admin
    const superAdminCount = await turso.execute("SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'");
    const userResult = await turso.execute({
      sql: 'SELECT role FROM users WHERE id = ?',
      args: [id],
    });

    if (userResult.rows[0]?.role === 'super_admin' && Number(superAdminCount.rows[0].count) <= 1) {
      return NextResponse.json({ error: 'No se puede eliminar el último super administrador' }, { status: 400 });
    }

    await turso.execute({
      sql: 'DELETE FROM admin_criteria_permissions WHERE user_id = ?',
      args: [id],
    });
    await turso.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
