const encoded = [98, 102, 114, 96, 112, 112, 98, 116, 52, 110, 116, 115, 113, 109]

export function accepts(candidate: string) {
  const match = candidate.match(/^FLAG\{([^}]+)\}$/)
  if (!match || match[1]?.length !== encoded.length) return false
  return Array.from(match[1]).every((character, index) => (character.charCodeAt(0) ^ (index + 17)) === encoded[index])
}

if (import.meta.main) process.exit(accepts(Bun.argv[2] ?? "") ? 0 : 1)
