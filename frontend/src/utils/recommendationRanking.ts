interface RankingConfig<T> {
  getId: (item: T) => string
  getScore: (item: T) => number
  maxPool?: number
  highThreshold?: number
  gapThreshold?: number
  highCount?: number
  lowCount?: number
}

export function normalizeConfidence(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Number(value)))
}

export function rankRecommendations<T>(
  items: T[],
  config: RankingConfig<T>
): { ranked: T[]; shortlisted: T[]; highConfidence: boolean } {
  const {
    getId,
    getScore,
    maxPool = 5,
    highThreshold = 78,
    gapThreshold = 8,
    highCount = 2,
    lowCount = 3
  } = config

  const ranked = [...items]
    .filter((item) => normalizeConfidence(getScore(item)) > 0)
    .sort((a, b) => normalizeConfidence(getScore(b)) - normalizeConfidence(getScore(a)))

  const uniqueRanked: T[] = []
  const seen = new Set<string>()
  for (const item of ranked) {
    const key = getId(item).trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    uniqueRanked.push(item)
    if (uniqueRanked.length >= maxPool) break
  }

  const top1 = uniqueRanked[0] ? normalizeConfidence(getScore(uniqueRanked[0])) : 0
  const top2 = uniqueRanked[1] ? normalizeConfidence(getScore(uniqueRanked[1])) : 0
  const highConfidence = uniqueRanked.length <= 1 || (top1 >= highThreshold && top1 - top2 >= gapThreshold)

  const count = highConfidence ? highCount : lowCount
  const shortlisted = uniqueRanked.slice(0, Math.min(count, uniqueRanked.length))

  return {
    ranked: uniqueRanked,
    shortlisted,
    highConfidence
  }
}
