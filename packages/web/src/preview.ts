import { process, defaultStyles, type SelectValues } from '@ifc-calc/core';
import { parseGef, type GefData } from '@ifc-calc/core';
import 'katex/dist/katex.min.css';

let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = defaultStyles;
  document.head.appendChild(style);
  styleInjected = true;
}

// State for interactive select elements
const selectState: SelectValues = {};
let lastSource = '';
let lastContainer: HTMLElement | null = null;

// Store parsed GEF data per variable name
const gefDataStore: Record<string, GefData> = {};
// Store uploaded filenames per variable name
const gefFileNames: Record<string, string> = {};

function renderWithState(container: HTMLElement, source: string): void {
  try {
    container.innerHTML = process(source, selectState);
  } catch (err) {
    container.innerHTML = `<div class="ifc-calc"><p class="calc-text" style="color:#dc2626;">Render error: ${(err as Error).message}</p></div>`;
  }

  // Attach change listeners to all select elements
  const selects = container.querySelectorAll<HTMLSelectElement>('.calc-select-input');
  for (const sel of selects) {
    sel.addEventListener('change', () => {
      const varName = sel.dataset.var;
      if (varName) {
        selectState[varName] = sel.value;
        renderWithState(container, source);
      }
    });
  }

  // Attach GEF upload handlers
  attachGefHandlers(container, source);
}

// ─── GEF Upload Handling ─────────────────────────────────────────────

function attachGefHandlers(container: HTMLElement, source: string): void {
  const uploads = container.querySelectorAll<HTMLElement>('.calc-gef-upload');

  for (const upload of uploads) {
    const varName = upload.dataset.gefVar;
    if (!varName) continue;

    const dropzone = upload.querySelector<HTMLElement>('.calc-gef-dropzone');
    const fileInput = upload.querySelector<HTMLInputElement>('.calc-gef-input');
    const resultDiv = upload.querySelector<HTMLElement>('.calc-gef-result');

    if (!dropzone || !fileInput || !resultDiv) continue;

    // If we already have data for this variable, restore the display
    if (gefDataStore[varName]) {
      showGefResult(upload, varName);
    }

    // File input change handler
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        handleGefFile(file, varName, container, source);
      }
    });

    // Drag-and-drop handlers
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (file) {
        handleGefFile(file, varName, container, source);
      }
    });
  }
}

function handleGefFile(
  file: File,
  varName: string,
  container: HTMLElement,
  source: string
): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const content = reader.result as string;
      const data = parseGef(content);
      gefDataStore[varName] = data;
      gefFileNames[varName] = file.name;

      // Re-render to update the display (the upload element gets recreated)
      renderWithState(container, source);
    } catch (err) {
      alert(`Fout bij het lezen van GEF-bestand: ${(err as Error).message}`);
    }
  };
  reader.readAsText(file);
}

function showGefResult(uploadEl: HTMLElement, varName: string): void {
  const data = gefDataStore[varName];
  const fileName = gefFileNames[varName];
  if (!data) return;

  const dropzone = uploadEl.querySelector<HTMLElement>('.calc-gef-dropzone');
  const resultDiv = uploadEl.querySelector<HTMLElement>('.calc-gef-result');
  const fileNameDiv = uploadEl.querySelector<HTMLElement>('.calc-gef-filename');
  const chartDiv = uploadEl.querySelector<HTMLElement>('.calc-gef-chart');
  const valuesDiv = uploadEl.querySelector<HTMLElement>('.calc-gef-values');

  if (!resultDiv || !fileNameDiv || !chartDiv || !valuesDiv) return;

  // Hide dropzone, show result
  if (dropzone) dropzone.style.display = 'none';
  resultDiv.style.display = 'block';

  // Show filename
  fileNameDiv.textContent = fileName || 'GEF-bestand';

  // Extract pile parameters from selectState or use sensible defaults
  const pileParams: PileParams = {
    napMaaiveld: parseFloat(selectState['napMaaiveld'] ?? '0.00'),
    napPaalkop: parseFloat(selectState['z_kop'] ?? '-1.00'),
    napPaalpunt: parseFloat(selectState['z_punt'] ?? '-12.00'),
    napWater: parseFloat(selectState['napWater'] ?? '-0.50'),
    napNegKleef: parseFloat(selectState['napNegKleef'] ?? '-5.00'),
    diameter: parseFloat(selectState['D_eq'] ?? '150'),
    NEd: parseFloat(selectState['N_Ed'] ?? '130'),
    Nk: parseFloat(selectState['N_k'] ?? '130'),
  };

  // Calculate qc values with pile-aware zones
  const stats = calculateQcValues(data, pileParams);
  pileParams.qcI = stats.qcI;
  pileParams.qcII = stats.qcII;
  pileParams.qcIII = stats.qcIII;

  // Draw CPT chart
  chartDiv.innerHTML = createCptChart(data, fileName, pileParams);

  // Show values summary
  const D_m = (pileParams.diameter ?? 150) / 1000;
  valuesDiv.innerHTML = `
    <strong>Sonderingsgegevens (uit GEF):</strong><br>
    Diepte bereik: ${data.depths[0].toFixed(2)} m - ${data.depths[data.depths.length - 1].toFixed(2)} m<br>
    Max q<sub>c</sub>: ${Math.max(...data.qc).toFixed(2)} MPa<br>
    NAP niveau: ${data.nafLevel.toFixed(2)} m<br>
    Paalpuntniveau: NAP ${(pileParams.napPaalpunt ?? -12).toFixed(2)} m<br>
    Paaldiameter D: ${(pileParams.diameter ?? 150).toFixed(0)} mm<br>
    <br>
    <strong>Trajecten (NEN 9997-1):</strong><br>
    Traject I: NAP ${((pileParams.napPaalpunt ?? -12) - 0.7 * D_m).toFixed(2)} tot NAP ${((pileParams.napPaalpunt ?? -12) + 4 * D_m).toFixed(2)} m<br>
    Traject III: NAP ${((pileParams.napPaalpunt ?? -12) - 8 * D_m).toFixed(2)} tot NAP ${((pileParams.napPaalpunt ?? -12) - 0.7 * D_m).toFixed(2)} m<br>
    <br>
    <strong>q<sub>c;I</sub></strong> = ${stats.qcI.toFixed(2)} MPa (gemiddelde traject I: paalpunt - 0.7D tot paalpunt + 4D)<br>
    <strong>q<sub>c;II</sub></strong> = ${stats.qcII.toFixed(2)} MPa (minimum traject I)<br>
    <strong>q<sub>c;III</sub></strong> = ${stats.qcIII.toFixed(2)} MPa (gemiddelde traject III: paalpunt - 8D tot paalpunt - 0.7D)
  `;
}

interface PileParams {
  napMaaiveld?: number;
  napPaalkop?: number;
  napPaalpunt?: number;
  napWater?: number;
  napNegKleef?: number;
  diameter?: number;       // mm
  NEd?: number;            // kN design load
  Nk?: number;             // kN characteristic load
  Rb?: number;             // kN tip resistance
  Rs?: number;             // kN shaft resistance
  Fnk?: number;            // kN negative friction
  qcI?: number;            // MPa
  qcII?: number;           // MPa
  qcIII?: number;          // MPa
}

interface QcStats {
  qcI: number;
  qcII: number;
  qcIII: number;
}

function calculateQcValues(data: GefData, pileParams?: PileParams): QcStats {
  const n = data.depths.length;
  if (n === 0) return { qcI: 0, qcII: 0, qcIII: 0 };

  const napPaalpunt = pileParams?.napPaalpunt ?? -12;
  const D_mm = pileParams?.diameter ?? 150;
  const D_m = D_mm / 1000; // diameter in meters
  const nafLevel = data.nafLevel;

  // Convert GEF depths (positive, from surface) to NAP levels
  // NAP level = nafLevel - depth
  // We need to find data points within specific NAP ranges

  // Traject I: paalpunt - 0.7D to paalpunt + 4D (for qc;I average and qc;II minimum)
  const trajI_top = napPaalpunt + 4 * D_m;   // higher NAP = shallower
  const trajI_bottom = napPaalpunt - 0.7 * D_m; // lower NAP = deeper

  // Traject III: paalpunt - 8D to paalpunt - 0.7D (for qc;III average)
  const trajIII_top = napPaalpunt - 0.7 * D_m;
  const trajIII_bottom = napPaalpunt - 8 * D_m;

  // Collect qc values in each trajectory
  const qcTrajI: number[] = [];
  const qcTrajIII: number[] = [];

  for (let i = 0; i < n; i++) {
    const napLevel_i = nafLevel - data.depths[i];

    // Traject I: between trajI_bottom and trajI_top
    if (napLevel_i <= trajI_top && napLevel_i >= trajI_bottom) {
      qcTrajI.push(data.qc[i]);
    }

    // Traject III: between trajIII_bottom and trajIII_top
    if (napLevel_i <= trajIII_top && napLevel_i >= trajIII_bottom) {
      qcTrajIII.push(data.qc[i]);
    }
  }

  // qc;I = average of trajectory I
  const qcI = qcTrajI.length > 0 ? average(qcTrajI) : 0;
  // qc;II = minimum of trajectory I
  const qcII = qcTrajI.length > 0 ? Math.min(...qcTrajI) : 0;
  // qc;III = average of trajectory III
  const qcIII = qcTrajIII.length > 0 ? average(qcTrajIII) : 0;

  return { qcI, qcII, qcIII };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

// ─── CPT Chart SVG ───────────────────────────────────────────────────

function createCptChart(
  data: GefData,
  fileName?: string,
  pileParams?: PileParams
): string {
  // ── Layout constants ──────────────────────────────────────────────
  const width = 700;
  const height = 600;
  const margin = { top: 52, right: 15, bottom: 30, left: 58 };

  // Panel widths (within the available area)
  const qcPlotWidth = 340;      // left panel: qc plot
  const zoneWidth = 80;         // middle panel: averaging zones
  const forceWidth = 100;       // right panel: force diagram
  const frictionWidth = 80;     // far right: friction ratio

  // Panel x-offsets
  const qcLeft = margin.left;
  const zoneLeft = qcLeft + qcPlotWidth + 12;
  const forceLeft = zoneLeft + zoneWidth + 12;
  const frictionLeft = forceLeft + forceWidth + 12;

  const plotH = height - margin.top - margin.bottom;

  // ── Data ranges ───────────────────────────────────────────────────
  const nafLevel = data.nafLevel;
  const napMaaiveld = pileParams?.napMaaiveld ?? 0;
  const napPaalkop = pileParams?.napPaalkop ?? -1;
  const napPaalpunt = pileParams?.napPaalpunt ?? -12;
  const napWater = pileParams?.napWater ?? -0.5;
  const napNegKleef = pileParams?.napNegKleef ?? -5;
  const D_mm = pileParams?.diameter ?? 150;
  const D_m = D_mm / 1000;

  // Convert GEF depths to NAP levels
  const napLevels = data.depths.map(d => nafLevel - d);
  const napMin = Math.min(...napLevels, napPaalpunt - 2); // deepest
  const napMax = Math.max(...napLevels, napMaaiveld + 1); // shallowest

  // Round to nice range
  const napRangeTop = Math.ceil(napMax);
  const napRangeBottom = Math.floor(napMin);

  const maxQc = Math.max(...data.qc, 1);
  const qcAxisMax = Math.max(30, Math.ceil(maxQc / 5) * 5);

  // ── Scale functions ───────────────────────────────────────────────
  const xScaleQc = (qc: number) => qcLeft + (qc / qcAxisMax) * qcPlotWidth;
  const yScaleNap = (nap: number) =>
    margin.top + ((napRangeTop - nap) / (napRangeTop - napRangeBottom)) * plotH;

  // Friction ratio scale (0-10%)
  const maxFr = 10;
  const xScaleFr = (fr: number) => frictionLeft + (fr / maxFr) * frictionWidth;

  // ── SVG parts ─────────────────────────────────────────────────────
  const parts: string[] = [];

  // ── Defs (arrow markers, patterns) ────────────────────────────────
  parts.push(`<defs>
    <marker id="cpt-arrowDown" markerWidth="8" markerHeight="10" refX="4" refY="10" orient="auto">
      <polygon points="0,0 8,0 4,10" fill="#dc2626"/>
    </marker>
    <marker id="cpt-arrowUp" markerWidth="8" markerHeight="10" refX="4" refY="0" orient="auto">
      <polygon points="0,10 8,10 4,0" fill="#059669"/>
    </marker>
    <clipPath id="clip-qcPlot">
      <rect x="${qcLeft}" y="${margin.top}" width="${qcPlotWidth}" height="${plotH}"/>
    </clipPath>
    <clipPath id="clip-frPlot">
      <rect x="${frictionLeft}" y="${margin.top}" width="${frictionWidth}" height="${plotH}"/>
    </clipPath>
  </defs>`);

  // ── Background ────────────────────────────────────────────────────
  parts.push(`<rect width="${width}" height="${height}" fill="white"/>`);

  // ── Title ─────────────────────────────────────────────────────────
  const title = fileName ? `Sondering: ${fileName.replace(/\.gef$/i, '')}` : 'Sondering';
  parts.push(`<text x="${qcLeft + qcPlotWidth / 2}" y="18" text-anchor="middle" font-size="13" fill="#1e40af" font-weight="bold" font-family="sans-serif">${escSvg(title)}</text>`);

  // ── qc Plot: grid and axes ────────────────────────────────────────
  // X-axis at TOP with ticks
  const xTicks = niceTickCount(0, qcAxisMax, 6);
  for (const tick of xTicks) {
    const x = xScaleQc(tick);
    // Vertical grid line
    parts.push(`<line x1="${f(x)}" y1="${margin.top}" x2="${f(x)}" y2="${f(margin.top + plotH)}" stroke="#e5e7eb" stroke-width="0.5"/>`);
    // Tick mark at top
    parts.push(`<line x1="${f(x)}" y1="${margin.top}" x2="${f(x)}" y2="${margin.top - 4}" stroke="#9ca3af" stroke-width="1"/>`);
    // Tick label at top
    parts.push(`<text x="${f(x)}" y="${margin.top - 7}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="sans-serif">${tick}</text>`);
  }
  // X-axis label
  parts.push(`<text x="${f(qcLeft + qcPlotWidth / 2)}" y="${margin.top - 20}" text-anchor="middle" font-size="10" fill="#374151" font-weight="600" font-family="sans-serif">q</text>`);
  parts.push(`<text x="${f(qcLeft + qcPlotWidth / 2 + 6)}" y="${margin.top - 17}" text-anchor="middle" font-size="7" fill="#374151" font-family="sans-serif">c</text>`);
  parts.push(`<text x="${f(qcLeft + qcPlotWidth / 2 + 18)}" y="${margin.top - 20}" text-anchor="middle" font-size="10" fill="#374151" font-family="sans-serif">(MPa)</text>`);

  // Y-axis ticks (NAP levels)
  const yTicks = niceTickCount(napRangeBottom, napRangeTop, 10);
  for (const tick of yTicks) {
    const y = yScaleNap(tick);
    // Horizontal grid line
    parts.push(`<line x1="${qcLeft}" y1="${f(y)}" x2="${f(qcLeft + qcPlotWidth)}" y2="${f(y)}" stroke="#e5e7eb" stroke-width="0.5"/>`);
    // Tick label
    parts.push(`<text x="${qcLeft - 4}" y="${f(y + 3)}" text-anchor="end" font-size="9" fill="#6b7280" font-family="sans-serif">${tick.toFixed(0)}</text>`);
  }
  // Y-axis label
  parts.push(`<text x="13" y="${f(margin.top + plotH / 2)}" text-anchor="middle" font-size="10" fill="#374151" font-weight="600" font-family="sans-serif" transform="rotate(-90, 13, ${f(margin.top + plotH / 2)})">NAP (m)</text>`);

  // Plot area border
  parts.push(`<rect x="${qcLeft}" y="${margin.top}" width="${qcPlotWidth}" height="${plotH}" fill="none" stroke="#d1d5db" stroke-width="1"/>`);

  // ── Pile representation ───────────────────────────────────────────
  const pileX = qcLeft + qcPlotWidth - 28;
  const pileW = 10;
  const pileTopY = yScaleNap(napPaalkop);
  const pileBotY = yScaleNap(napPaalpunt);

  // Pile shaft (brown/red rectangle)
  parts.push(`<rect x="${f(pileX)}" y="${f(pileTopY)}" width="${pileW}" height="${f(pileBotY - pileTopY)}" fill="#b45309" stroke="#92400e" stroke-width="0.8" opacity="0.85"/>`);
  // Pile tip triangle
  parts.push(`<polygon points="${f(pileX)},${f(pileBotY)} ${f(pileX + pileW)},${f(pileBotY)} ${f(pileX + pileW / 2)},${f(pileBotY + 6)}" fill="#92400e"/>`);

  // ── Averaging zones (colored rectangles next to pile) ─────────────
  // Zone backgrounds in the zone panel
  const trajI_top = napPaalpunt + 4 * D_m;
  const trajI_bottom = napPaalpunt - 0.7 * D_m;
  const trajIII_top = napPaalpunt - 0.7 * D_m;
  const trajIII_bottom = napPaalpunt - 8 * D_m;

  // Clamp zone display to plot range
  const clampY = (nap: number) => yScaleNap(Math.max(napRangeBottom, Math.min(napRangeTop, nap)));

  // Zone I (green) - paalpunt - 0.7D to paalpunt + 4D
  const zoneITopY = clampY(trajI_top);
  const zoneIBotY = clampY(trajI_bottom);
  parts.push(`<rect x="${zoneLeft}" y="${f(zoneITopY)}" width="${zoneWidth}" height="${f(zoneIBotY - zoneITopY)}" fill="rgba(34,197,94,0.3)" stroke="rgba(34,197,94,0.6)" stroke-width="0.5"/>`);
  parts.push(`<text x="${f(zoneLeft + zoneWidth / 2)}" y="${f((zoneITopY + zoneIBotY) / 2 - 4)}" text-anchor="middle" font-size="8" fill="#166534" font-family="sans-serif" font-weight="600">q</text>`);
  parts.push(`<text x="${f(zoneLeft + zoneWidth / 2 + 5)}" y="${f((zoneITopY + zoneIBotY) / 2 - 1)}" text-anchor="middle" font-size="6" fill="#166534" font-family="sans-serif">c;I</text>`);
  if (pileParams?.qcI != null) {
    parts.push(`<text x="${f(zoneLeft + zoneWidth / 2)}" y="${f((zoneITopY + zoneIBotY) / 2 + 9)}" text-anchor="middle" font-size="7.5" fill="#166534" font-family="sans-serif">${pileParams.qcI.toFixed(1)} MPa</text>`);
  }

  // Zone II (yellow) - same range as I but minimum value
  // Show as a thin overlay stripe
  const zoneIIMidY = (zoneITopY + zoneIBotY) / 2;
  parts.push(`<rect x="${zoneLeft}" y="${f(zoneIIMidY + 12)}" width="${zoneWidth}" height="18" fill="rgba(234,179,8,0.3)" stroke="rgba(234,179,8,0.6)" stroke-width="0.5"/>`);
  parts.push(`<text x="${f(zoneLeft + zoneWidth / 2)}" y="${f(zoneIIMidY + 22)}" text-anchor="middle" font-size="7.5" fill="#854d0e" font-family="sans-serif" font-weight="600">q<tspan font-size="5.5" dy="1">c;II</tspan><tspan dy="-1"> = ${(pileParams?.qcII ?? 0).toFixed(1)}</tspan></text>`);

  // Zone III (pink) - paalpunt - 8D to paalpunt - 0.7D
  const zoneIIITopY = clampY(trajIII_top);
  const zoneIIIBotY = clampY(trajIII_bottom);
  if (zoneIIIBotY - zoneIIITopY > 2) {
    parts.push(`<rect x="${zoneLeft}" y="${f(zoneIIITopY)}" width="${zoneWidth}" height="${f(zoneIIIBotY - zoneIIITopY)}" fill="rgba(244,63,94,0.3)" stroke="rgba(244,63,94,0.6)" stroke-width="0.5"/>`);
    parts.push(`<text x="${f(zoneLeft + zoneWidth / 2)}" y="${f((zoneIIITopY + zoneIIIBotY) / 2 - 4)}" text-anchor="middle" font-size="8" fill="#9f1239" font-family="sans-serif" font-weight="600">q</text>`);
    parts.push(`<text x="${f(zoneLeft + zoneWidth / 2 + 6)}" y="${f((zoneIIITopY + zoneIIIBotY) / 2 - 1)}" text-anchor="middle" font-size="6" fill="#9f1239" font-family="sans-serif">c;III</text>`);
    if (pileParams?.qcIII != null) {
      parts.push(`<text x="${f(zoneLeft + zoneWidth / 2)}" y="${f((zoneIIITopY + zoneIIIBotY) / 2 + 9)}" text-anchor="middle" font-size="7.5" fill="#9f1239" font-family="sans-serif">${pileParams.qcIII.toFixed(1)} MPa</text>`);
    }
  }

  // Zone panel header
  parts.push(`<text x="${f(zoneLeft + zoneWidth / 2)}" y="${margin.top - 7}" text-anchor="middle" font-size="9" fill="#374151" font-weight="600" font-family="sans-serif">Trajecten</text>`);
  parts.push(`<rect x="${zoneLeft}" y="${margin.top}" width="${zoneWidth}" height="${plotH}" fill="none" stroke="#d1d5db" stroke-width="0.5"/>`);

  // ── NAP level lines (dashed, across qc plot) ──────────────────────
  const napLines: Array<{ nap: number; label: string; color: string; dash: string }> = [
    { nap: napMaaiveld, label: 'maaiveld', color: '#8b5c2a', dash: '4,2' },
    { nap: napWater, label: 'waterniveau', color: '#2563eb', dash: '3,3' },
    { nap: napPaalkop, label: 'paalkop', color: '#6b7280', dash: '6,2' },
    { nap: napNegKleef, label: 'neg. kleef', color: '#d97706', dash: '4,2' },
    { nap: napPaalpunt, label: 'paalpunt', color: '#6b7280', dash: '6,2' },
  ];

  for (const nl of napLines) {
    if (nl.nap < napRangeBottom || nl.nap > napRangeTop) continue;
    const y = yScaleNap(nl.nap);
    parts.push(`<line x1="${qcLeft}" y1="${f(y)}" x2="${f(qcLeft + qcPlotWidth)}" y2="${f(y)}" stroke="${nl.color}" stroke-width="0.8" stroke-dasharray="${nl.dash}" opacity="0.7"/>`);
    parts.push(`<text x="${f(qcLeft + 3)}" y="${f(y - 3)}" font-size="7.5" fill="${nl.color}" font-family="sans-serif">${nl.label} NAP ${nl.nap.toFixed(2)}</text>`);
  }

  // ── Maaiveld hatching (ground surface indicator) ──────────────────
  const mvY = yScaleNap(napMaaiveld);
  if (mvY >= margin.top && mvY <= margin.top + plotH) {
    // Brown strip at maaiveld
    parts.push(`<rect x="${qcLeft}" y="${f(mvY - 1)}" width="${qcPlotWidth}" height="3" fill="#8b7355" opacity="0.5"/>`);
  }

  // ── qc line (main CPT trace) ──────────────────────────────────────
  const qcPoints = data.depths.map((d, i) => {
    const napLvl = nafLevel - d;
    return `${f(xScaleQc(data.qc[i]))},${f(yScaleNap(napLvl))}`;
  });
  if (qcPoints.length > 0) {
    const pathD = 'M' + qcPoints.join(' L');
    parts.push(`<path d="${pathD}" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-linejoin="round" clip-path="url(#clip-qcPlot)"/>`);
  }

  // ── Friction ratio panel (far right) ──────────────────────────────
  // Header
  parts.push(`<text x="${f(frictionLeft + frictionWidth / 2)}" y="${margin.top - 7}" text-anchor="middle" font-size="9" fill="#374151" font-weight="600" font-family="sans-serif">Rf (%)</text>`);
  parts.push(`<rect x="${frictionLeft}" y="${margin.top}" width="${frictionWidth}" height="${plotH}" fill="none" stroke="#d1d5db" stroke-width="0.5"/>`);

  // Friction ratio x-axis ticks at top
  for (let fr = 0; fr <= maxFr; fr += 2) {
    const x = xScaleFr(fr);
    parts.push(`<line x1="${f(x)}" y1="${margin.top}" x2="${f(x)}" y2="${f(margin.top + plotH)}" stroke="#e5e7eb" stroke-width="0.3"/>`);
    parts.push(`<text x="${f(x)}" y="${f(margin.top + plotH + 10)}" text-anchor="middle" font-size="7" fill="#9ca3af" font-family="sans-serif">${fr}</text>`);
  }

  // Friction ratio line (if fs data available)
  if (data.fs.length === data.depths.length) {
    const frPoints: string[] = [];
    for (let i = 0; i < data.depths.length; i++) {
      const napLvl = nafLevel - data.depths[i];
      const frictionRatio = data.qc[i] > 0 ? (data.fs[i] / data.qc[i]) * 100 : 0;
      const clampedFr = Math.min(frictionRatio, maxFr);
      frPoints.push(`${f(xScaleFr(clampedFr))},${f(yScaleNap(napLvl))}`);
    }
    if (frPoints.length > 0) {
      parts.push(`<path d="M${frPoints.join(' L')}" fill="none" stroke="#f97316" stroke-width="0.8" stroke-linejoin="round" clip-path="url(#clip-frPlot)"/>`);
    }
  }

  // ── Force diagram (right side) ────────────────────────────────────
  const forceCenterX = forceLeft + forceWidth / 2;
  parts.push(`<text x="${f(forceCenterX)}" y="${margin.top - 7}" text-anchor="middle" font-size="9" fill="#374151" font-weight="600" font-family="sans-serif">Krachten</text>`);
  parts.push(`<rect x="${forceLeft}" y="${margin.top}" width="${forceWidth}" height="${plotH}" fill="none" stroke="#d1d5db" stroke-width="0.5"/>`);

  // Force arrow positions relative to pile
  const forceTopY = pileTopY;
  const forceBotY = pileBotY;
  const forceMidY = napNegKleef >= napRangeBottom ? yScaleNap(napNegKleef) : (forceTopY + forceBotY) / 2;

  // NEd or Nk arrow (down, red) at top
  const loadLabel = pileParams?.NEd != null
    ? `N_Ed = ${pileParams.NEd.toFixed(0)} kN`
    : pileParams?.Nk != null
      ? `N_k = ${pileParams.Nk.toFixed(0)} kN`
      : '';
  if (loadLabel) {
    const arrowStartY = Math.max(margin.top + 8, forceTopY - 35);
    parts.push(`<line x1="${f(forceCenterX)}" y1="${f(arrowStartY)}" x2="${f(forceCenterX)}" y2="${f(forceTopY - 2)}" stroke="#dc2626" stroke-width="2" marker-end="url(#cpt-arrowDown)"/>`);
    parts.push(`<text x="${f(forceCenterX)}" y="${f(arrowStartY - 4)}" text-anchor="middle" font-size="7.5" fill="#dc2626" font-family="sans-serif" font-weight="600">${escSvg(loadLabel)}</text>`);
  }

  // Negative friction arrow (small, down, red/orange)
  if (pileParams?.Fnk != null && pileParams.Fnk > 0) {
    parts.push(`<line x1="${f(forceCenterX - 15)}" y1="${f(forceTopY + 10)}" x2="${f(forceCenterX - 15)}" y2="${f(forceMidY - 5)}" stroke="#d97706" stroke-width="1.2" stroke-dasharray="3,2" marker-end="url(#cpt-arrowDown)"/>`);
    parts.push(`<text x="${f(forceCenterX - 15)}" y="${f((forceTopY + forceMidY) / 2)}" text-anchor="end" font-size="7" fill="#d97706" font-family="sans-serif" transform="rotate(-90, ${f(forceCenterX - 22)}, ${f((forceTopY + forceMidY) / 2)})">${pileParams.Fnk.toFixed(0)} kN</text>`);
  }

  // Shaft resistance arrow (up, green)
  if (pileParams?.Rs != null && pileParams.Rs > 0) {
    parts.push(`<line x1="${f(forceCenterX + 15)}" y1="${f(forceBotY - 10)}" x2="${f(forceCenterX + 15)}" y2="${f(forceMidY + 10)}" stroke="#059669" stroke-width="1.5" marker-end="url(#cpt-arrowUp)"/>`);
    parts.push(`<text x="${f(forceCenterX + 20)}" y="${f((forceMidY + forceBotY) / 2)}" text-anchor="start" font-size="7.5" fill="#059669" font-family="sans-serif">R_s = ${pileParams.Rs.toFixed(0)} kN</text>`);
  }

  // Tip resistance arrow (up, green)
  if (pileParams?.Rb != null && pileParams.Rb > 0) {
    const tipArrowBot = Math.min(forceBotY + 30, margin.top + plotH - 5);
    parts.push(`<line x1="${f(forceCenterX)}" y1="${f(tipArrowBot)}" x2="${f(forceCenterX)}" y2="${f(forceBotY + 4)}" stroke="#059669" stroke-width="2" marker-end="url(#cpt-arrowUp)"/>`);
    parts.push(`<text x="${f(forceCenterX)}" y="${f(tipArrowBot + 12)}" text-anchor="middle" font-size="7.5" fill="#059669" font-family="sans-serif" font-weight="600">R_b = ${pileParams.Rb.toFixed(0)} kN</text>`);
  }

  // If no specific force values, show a schematic pile outline in force panel
  if (pileParams?.Rb == null && pileParams?.Rs == null) {
    // Draw a simple schematic pile in the force panel
    const schemPileW = 8;
    const schemX = forceCenterX - schemPileW / 2;
    parts.push(`<rect x="${f(schemX)}" y="${f(forceTopY)}" width="${schemPileW}" height="${f(forceBotY - forceTopY)}" fill="#d4c5a0" stroke="#92400e" stroke-width="0.6" opacity="0.5"/>`);
  }

  // ── Combine SVG ───────────────────────────────────────────────────
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; font-family: 'Segoe UI', system-ui, sans-serif;">
${parts.join('\n')}
</svg>`;
}

/** Format number for SVG attributes */
function f(n: number): string {
  return n.toFixed(1);
}

/** Escape text for SVG content */
function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function niceTickCount(min: number, max: number, approxCount: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const rawStep = range / approxCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  let step: number;
  const normalized = rawStep / magnitude;
  if (normalized <= 1.5) step = magnitude;
  else if (normalized <= 3.5) step = 2 * magnitude;
  else if (normalized <= 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;

  const ticks: number[] = [];
  let tick = Math.ceil(min / step) * step;
  while (tick <= max) {
    ticks.push(tick);
    tick += step;
  }
  return ticks;
}

export function updatePreview(container: HTMLElement, source: string): void {
  injectStyles();
  lastSource = source;
  lastContainer = container;
  renderWithState(container, source);
}
