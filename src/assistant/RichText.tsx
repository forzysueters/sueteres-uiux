import React, { useMemo } from 'react';
import { cn } from '../lib/utils';

/**
 * Renderizador do Markdown leve que o modelo devolve.
 *
 * O `ai-chat` responde em Markdown — `**negrito**`, `*ênfase*` e listas com
 * hífen. Jogar isso num `<p>` mostra os asteriscos literais e ainda colapsa as
 * quebras de linha, transformando uma lista de sete ativos num parágrafo único.
 *
 * É um parser deliberadamente pequeno: blocos (parágrafo, lista, título) e três
 * marcações inline. Nada de biblioteca de Markdown — e nada de
 * `dangerouslySetInnerHTML`: o texto vem de um modelo, então ele vira nó React,
 * nunca HTML.
 */

// Uma marcação inline por vez, sem aninhamento. `**` precisa vir antes de `*`.
const INLINE = /(\*\*[^*]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g;

const BULLET = /^\s*[-*•–]\s+(.+)$/;
const ORDERED = /^\s*\d+[.)]\s+(.+)$/;
const HEADING = /^\s*#{1,6}\s+(.+)$/;
/** `*Crítico*` sozinho numa linha é ênfase, não item de lista. */
const LONE_EMPHASIS = /^\s*\*[^*]+\*\s*$/;

const renderInline = (text: string, keyBase: string): React.ReactNode[] =>
  text
    .split(INLINE)
    .filter(Boolean)
    .map((token, i) => {
      const key = `${keyBase}-${i}`;
      if (token.length > 4 && token.startsWith('**') && token.endsWith('**')) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.length > 2 && token.startsWith('`') && token.endsWith('`')) {
        return (
          <code
            key={key}
            className="rounded bg-card-hover px-1 py-0.5 font-mono text-[11px] text-foreground-soft"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.length > 2 && token.startsWith('*') && token.endsWith('*')) {
        return (
          <em key={key} className="italic text-foreground-soft">
            {token.slice(1, -1)}
          </em>
        );
      }
      return <React.Fragment key={key}>{token}</React.Fragment>;
    });

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'h'; text: string };

const parseBlocks = (source: string): Block[] => {
  const blocks: Block[] = [];
  let open: Block | null = null;

  const close = () => {
    if (open) blocks.push(open);
    open = null;
  };

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      close();
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      close();
      blocks.push({ kind: 'h', text: heading[1] });
      continue;
    }

    const ordered = line.match(ORDERED);
    if (ordered) {
      if (open?.kind !== 'ol') {
        close();
        open = { kind: 'ol', items: [] };
      }
      open.items.push(ordered[1]);
      continue;
    }

    const bullet = !LONE_EMPHASIS.test(line) && line.match(BULLET);
    if (bullet) {
      if (open?.kind !== 'ul') {
        close();
        open = { kind: 'ul', items: [] };
      }
      open.items.push(bullet[1]);
      continue;
    }

    if (open?.kind !== 'p') {
      close();
      open = { kind: 'p', lines: [] };
    }
    open.lines.push(line.trim());
  }

  close();
  return blocks;
};

const Bullet = () => (
  <span
    aria-hidden
    className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-primary/70"
  />
);

interface RichTextProps {
  text: string;
  className?: string;
}

export const RichText: React.FC<RichTextProps> = ({ text, className }) => {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={cn('space-y-2.5 text-sm leading-relaxed text-foreground-soft', className)}>
      {blocks.map((block, b) => {
        if (block.kind === 'h') {
          return (
            <p key={b} className="font-semibold text-foreground">
              {renderInline(block.text, `h${b}`)}
            </p>
          );
        }

        if (block.kind === 'ul') {
          return (
            <ul key={b} className="space-y-1.5">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <Bullet />
                  <span className="min-w-0">{renderInline(item, `u${b}-${i}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === 'ol') {
          return (
            <ol key={b} className="space-y-1.5">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-px flex-shrink-0 font-mono text-[11px] font-bold text-primary tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="min-w-0">{renderInline(item, `o${b}-${i}`)}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={b} className="whitespace-pre-line">
            {renderInline(block.lines.join('\n'), `p${b}`)}
          </p>
        );
      })}
    </div>
  );
};

/**
 * Texto limpo para a voz.
 *
 * Sem isto o sintetizador tropeça nos asteriscos e emenda os itens da lista
 * numa frase só — cada linha vira uma sentença, com a pausa que a leitura pede.
 */
export const stripMarkdown = (source: string): string =>
  source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(HEADING, '$1')
        .replace(BULLET, '$1')
        .replace(ORDERED, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .map((line) => (/[.!?:;,]$/.test(line) ? line : `${line}.`))
    .join(' ');
