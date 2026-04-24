const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Generates a week label in the format: "Domingo 05 - Abril 2026"
 */
export function formatWeekLabel(date: Date): string {
  const dayName = DAY_NAMES[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${dayNum} - ${monthName} ${year}`;
}

export { MONTH_NAMES };
