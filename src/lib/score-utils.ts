export function getScoreColor(score: number): string {
  if (score >= 17.5) return '#16A34A';
  if (score >= 16.5) return '#2563EB';
  if (score >= 12.5) return '#D4AF37';
  if (score >= 9.5) return '#C41E3A';
  return '#1a1a1a';
}

export function getScoreColorClass(score: number): string {
  if (score >= 17.5) return 'bg-green-600 text-white';
  if (score >= 16.5) return 'bg-blue-600 text-white';
  if (score >= 12.5) return 'bg-yellow-600 text-white';
  if (score >= 9.5) return 'bg-red-600 text-white';
  return 'bg-gray-800 text-white';
}

export function getScoreLabel(score: number): string {
  if (score >= 17.5) return 'Excelente';
  if (score >= 16.5) return 'Muy Bien';
  if (score >= 12.5) return 'Bien';
  if (score >= 9.5) return 'Regular';
  return 'Necesita Mejorar';
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
