// src/engine/interpolate.js
// Fonctions pures. Aucun import React/Zustand.

/**
 * Retourne la valeur interpolée d'une propriété à un instant t (ms).
 * Si aucun keyframe, retourne la valeur par défaut.
 * Interpolation linéaire entre keyframes.
 */
export function getValueAt(property, t) {
  const { value, keyframes } = property
  if (!keyframes || keyframes.length === 0) return value

  const sorted = [...keyframes].sort((a, b) => a.time - b.time)

  if (t <= sorted[0].time) return sorted[0].value
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.time && t <= b.time) {
      const progress = (t - a.time) / (b.time - a.time)
      return a.value + (b.value - a.value) * progress
    }
  }

  return value
}
