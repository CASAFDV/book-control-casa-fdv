import turso from './turso';
import { formatWeekLabel, MONTH_NAMES } from './week-utils';

export async function initializeDatabase() {
  // Users table
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Academic Years
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Weeks
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS weeks (
      id TEXT PRIMARY KEY,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
      week_number INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month_name TEXT NOT NULL,
      sunday_date TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Families
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#D4AF37',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Students
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Evaluation Criteria
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS criteria (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      order_index INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Grades
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      criteria_id TEXT NOT NULL REFERENCES criteria(id),
      week_id TEXT NOT NULL REFERENCES weeks(id),
      score REAL NOT NULL DEFAULT 0,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, criteria_id, week_id)
    )
  `);

  // General Comments
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS general_comments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      week_id TEXT NOT NULL REFERENCES weeks(id),
      comment TEXT NOT NULL DEFAULT '',
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, week_id)
    )
  `);

  // Admin Criteria Permissions
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS admin_criteria_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      criteria_id TEXT NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
      can_grade INTEGER DEFAULT 1,
      can_comment INTEGER DEFAULT 1,
      UNIQUE(user_id, criteria_id)
    )
  `);

  // Seed default criteria if empty
  const criteriaCount = await turso.execute('SELECT COUNT(*) as count FROM criteria');
  if (criteriaCount.rows[0].count === 0) {
    const defaultCriteria = [
      'ASISTENCIA',
      'PUNTUALIDAD',
      'MAYORDOMÍA',
      'PRESENTACIÓN I',
      'PRESENTACIÓN II',
      'CONDUCTA',
      'CONSAGRACIÓN',
      'ONG',
      'IGLESIA',
    ];
    for (let i = 0; i < defaultCriteria.length; i++) {
      await turso.execute({
        sql: 'INSERT INTO criteria (id, name, is_active, order_index) VALUES (?, ?, 1, ?)',
        args: [`crit_${i + 1}`, defaultCriteria[i], i + 1],
      });
    }
  }

  // Seed super admin if empty
  const adminCount = await turso.execute('SELECT COUNT(*) as count FROM users WHERE role = ?');
  if (adminCount.rows[0].count === 0) {
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default;
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await turso.execute({
      sql: 'INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)',
      args: ['super_admin_1', 'superadmin', hashedPassword, 'super_admin', 'Super Administrador'],
    });
  }

  // Seed default academic year if empty
  const yearCount = await turso.execute('SELECT COUNT(*) as count FROM academic_years');
  if (yearCount.rows[0].count === 0) {
    await turso.execute({
      sql: 'INSERT INTO academic_years (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 1)',
      args: ['year_2026_2027', '2026-2027', '2026-04-01', '2027-03-31'],
    });

    // Generate weeks from April 2026 to April 2027 (Sundays)
    let weekNum = 1;
    const startDate = new Date(2026, 3, 1); // April 1, 2026
    const endDate = new Date(2027, 3, 30); // April 30, 2027
    
    let currentDate = new Date(startDate);
    if (currentDate.getDay() !== 0) {
      currentDate.setDate(currentDate.getDate() + (7 - currentDate.getDay()));
    }
    
    while (currentDate <= endDate) {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      const sundayDate = currentDate.toISOString().split('T')[0];
      
      await turso.execute({
        sql: 'INSERT INTO weeks (id, academic_year_id, week_number, month, year, month_name, sunday_date, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [`week_${weekNum}_${year}`, 'year_2026_2027', weekNum, month + 1, year, MONTH_NAMES[month], sundayDate, formatWeekLabel(currentDate)],
      });
      
      weekNum++;
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
  }

  console.log('Database initialized successfully');
}
