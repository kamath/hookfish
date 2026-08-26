/** fzf-style sequential fuzzy score. Higher is better. Null if it does not match. */
export function fuzzyScore(haystack: string, query: string): number | null {
  const text = haystack.toLowerCase()
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return 0
  }

  let total = 0
  for (const token of tokens) {
    const score = scoreToken(text, token)
    if (score == null) {
      return null
    }
    total += score
  }
  return total
}

function scoreToken(text: string, token: string): number | null {
  let from = 0
  let score = 0
  let consecutive = 0
  let previous = -2

  for (const character of token) {
    const index = text.indexOf(character, from)
    if (index === -1) {
      return null
    }

    if (index === 0 || isBoundary(text, index)) {
      score += 8
    }
    if (index === previous + 1) {
      consecutive += 1
      score += 4 + consecutive
    } else {
      consecutive = 0
      score -= index - from
    }

    previous = index
    from = index + 1
  }

  return score - (text.length - token.length) * 0.01
}

function isBoundary(text: string, index: number) {
  if (index === 0) {
    return true
  }
  const previous = text[index - 1]
  const current = text[index]
  if (!previous || !current) {
    return false
  }
  if (/[/\-_.{}]/.test(previous)) {
    return true
  }
  return previous === previous.toLowerCase() && current !== current.toLowerCase()
}
