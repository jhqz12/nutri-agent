const KILOJOULES_PER_KILOCALORIE = 4.184

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function kilocaloriesToKilojoules(kilocalories: number): number {
  return round(Math.max(0, kilocalories) * KILOJOULES_PER_KILOCALORIE)
}

export function kilojoulesToKilocalories(kilojoules: number): number {
  return round(Math.max(0, kilojoules) / KILOJOULES_PER_KILOCALORIE)
}

export function calculateMacroCalories(protein: number, fat: number, carbs: number): number {
  return round(Math.max(0, protein) * 4 + Math.max(0, fat) * 9 + Math.max(0, carbs) * 4)
}

export const energyConversionNote = '1千卡(kcal)=4.184千焦(kJ)'
