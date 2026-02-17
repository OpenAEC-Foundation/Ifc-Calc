import { createEditor } from './editor';
import { updatePreview } from './preview';

const exampleDoc = `# Doorsnede Controle — Rechthoekige Balk

Breedte en hoogte van de balk:

b = 300 mm
h = 500 mm
A = b*h

Traagheidsmoment:

I = b*h^3 / 12

## Belasting

Normaalkracht en moment:

F = 150 kN
M = 25 kN*m

## Spanningscontrole

Normaalspanning (druk):

sigma_n = F / A to N/mm^2

Buigspanning:

W = b*h^2 / 6
sigma_m = M / W to N/mm^2

Totale spanning:

sigma_tot = sigma_n + sigma_m to N/mm^2

Materiaal sterkte (beton C30/37):

f_cd = 20 N/mm^2

Unity check:

UC = sigma_tot / f_cd

#if UC < 1
  Doorsnede is voldoende (UC < 1.0).
#else
  Doorsnede is NIET voldoende (UC >= 1.0)!
#end if

## Doorsnede Tekening

@svg
<svg width="400" height="340" viewBox="0 0 400 340">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#1e40af"/>
    </marker>
  </defs>
  <rect x="100" y="20" width="{{b}}" height="{{h}}" stroke="#1e40af" stroke-width="2" fill="#dbeafe" rx="2"/>
  <text x="250" y="335" text-anchor="middle" font-size="14" fill="#1e40af" font-style="italic">b = {{b}} mm</text>
  <text x="40" y="270" text-anchor="middle" font-size="14" fill="#1e40af" font-style="italic" transform="rotate(-90,40,270)">h = {{h}} mm</text>
</svg>
@end
`;

function debounce(fn: (arg: string) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (arg: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(arg), ms);
  };
}

const editorEl = document.getElementById('editor')!;
const previewEl = document.getElementById('preview')!;

// Initial render
updatePreview(previewEl, exampleDoc);

// Setup editor with live preview
const debouncedUpdate = debounce((content: string) => {
  updatePreview(previewEl, content);
}, 250);

createEditor(editorEl, exampleDoc, debouncedUpdate);
