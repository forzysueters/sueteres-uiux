/**
 * PDF do relatório do ativo, gerado no navegador para virar anexo de e-mail.
 *
 * Reaproveita o MESMO documento do botão "Imprimir" (`#asset-report`), em vez
 * de um terceiro layout: o que muda é só o destino. O detalhe é que aquele
 * documento existe na tela com `display: none` e só ganha forma dentro de
 * `@media print` — html2canvas fotografa o estado de tela, não o de impressão.
 * Por isso as regras de dentro do `@media print` são promovidas para escopo
 * normal num clone fora do fluxo, técnica já usada nesta base para conferir o
 * layout com o Edge headless.
 *
 * Falhar aqui não é crítico: quem chama manda o e-mail sem anexo.
 */

/** Largura útil da A4 (186 mm) em pixels a 96 dpi — a mesma do harness. */
const CONTENT_WIDTH_PX = 703;
const PAGE_MARGIN_MM = 12;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Junta as regras de dentro de `@media print` como CSS de escopo normal.
 *
 * `body:has(#asset-report) > *:not(#asset-report)` fica de fora de propósito:
 * ela existe para esconder o app durante a impressão e, promovida, esconderia
 * o próprio contêiner do clone — que também é filho direto do body.
 */
function promotedPrintCss(): string {
  const out: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Folha de outra origem: inacessível por CORS, e irrelevante aqui.
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes('print')) continue;

      for (const inner of Array.from(rule.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue;
        if (inner.selectorText.includes(':has(')) continue;
        out.push(inner.cssText);
      }
    }
  }

  return out.join('\n');
}

/**
 * Renderiza `#asset-report` em PDF A4 e devolve o conteúdo em base64 (sem o
 * prefixo `data:`). Devolve `null` se o documento não estiver montado ou se a
 * rasterização falhar.
 */
export async function generateAssetReportPdf(): Promise<string | null> {
  const source = document.getElementById('asset-report');
  if (!source) return null;

  // Import dinâmico: as duas libs somam ~500 KB e só interessam a quem exporta.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${CONTENT_WIDTH_PX}px`,
    'background:#ffffff',
    'z-index:-1',
  ].join(';');

  const style = document.createElement('style');
  style.textContent = promotedPrintCss();

  // O clone mantém o id: são os seletores `#asset-report` promovidos que lhe dão
  // forma. O original continua `display:none`, então o duplicado não aparece.
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.display = 'block';
  clone.style.width = `${CONTENT_WIDTH_PX}px`;

  holder.append(style, clone);
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: CONTENT_WIDTH_PX,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const usableWidth = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
    const usableHeight = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
    const imageHeight = (canvas.height * usableWidth) / canvas.width;
    const image = canvas.toDataURL('image/jpeg', 0.92);

    // Uma imagem alta cortada por página: cada folha reposiciona a mesma arte
    // para cima, o que é o suficiente para um anexo (o botão "Imprimir" segue
    // sendo o caminho de alta fidelidade, com quebra de página real).
    let remaining = imageHeight;
    let offset = 0;
    while (remaining > 0) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(
        image,
        'JPEG',
        PAGE_MARGIN_MM,
        PAGE_MARGIN_MM - offset,
        usableWidth,
        imageHeight,
      );
      remaining -= usableHeight;
      offset += usableHeight;
    }

    // `datauristring` volta como `data:application/pdf;filename=…;base64,XXXX`.
    return pdf.output('datauristring').replace(/^data:[^,]+,/, '');
  } catch (err) {
    console.warn('[report-pdf] não foi possível gerar o anexo:', (err as Error).message);
    return null;
  } finally {
    holder.remove();
  }
}
