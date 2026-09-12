/** Converte o subconjunto de Markdown do assistente em texto adequado à voz. */
export const stripMarkdown = (source: string): string =>
  source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+(.+)$/, '$1')
        .replace(/^\s*[-*•–]\s+(.+)$/, '$1')
        .replace(/^\s*\d+[.)]\s+(.+)$/, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .map((line) => (/[.!?:;,]$/.test(line) ? line : `${line}.`))
    .join(' ');
