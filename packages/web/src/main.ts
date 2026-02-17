import { createEditor } from './editor';
import { updatePreview } from './preview';

const exampleDoc = `# Toetsing Stalen Ligger — IPE 300, S235

## Profielgegevens IPE 300

h_p = 300 mm
b_p = 150 mm
t_w = 7.1 mm
t_f = 10.7 mm
A_p = 5381 mm^2
I_y = 83560000 mm^4
W_pl = 628400 mm^3

## Materiaal — S235

f_y = 235 N/mm^2
gamma_M0 = 1.0
f_yd = f_y / gamma_M0 to N/mm^2
E = 210000 N/mm^2

## Belasting en geometrie

Overspanning en gelijkmatig verdeelde belasting:

L = 6000 mm
q = 20 kN/m

## Krachtwerking

Maatgevend moment (veldmoment bij gelijkmatige belasting):

M_Ed = q*L^2 / 8 to kN*m

Maatgevende dwarskracht (oplegreactie):

V_Ed = q*L / 2 to kN

## Momentcapaciteit (plastisch)

M_Rd = W_pl * f_yd to kN*m

Unity check buiging:

UC_M = M_Ed / M_Rd

#if UC_M < 1
  Buiging voldoet (UC < 1.0).
#else
  Buiging voldoet NIET!
#end if

## Dwarskrachtcapaciteit

Afschuifoppervlak (vereenvoudigd):

A_v = h_p * t_w

V_Rd = A_v * f_yd / sqrt(3) to kN

Unity check dwarskracht:

UC_V = V_Ed / V_Rd

#if UC_V < 1
  Dwarskracht voldoet (UC < 1.0).
#else
  Dwarskracht voldoet NIET!
#end if

## Doorbuigingscontrole

Toelaatbare doorbuiging (L/250):

delta_max = L / 250 to mm

Optredende doorbuiging (5qL4/384EI):

delta = 5*q*L^4 / (384*E*I_y) to mm

Unity check doorbuiging:

UC_d = delta / delta_max

#if UC_d < 1
  Doorbuiging voldoet (UC < 1.0).
#else
  Doorbuiging voldoet NIET!
#end if

## Overzicht

@svg
<svg width="600" height="220" viewBox="0 0 600 220">
  <!-- Ligger -->
  <line x1="50" y1="100" x2="550" y2="100" stroke="#1e40af" stroke-width="3"/>
  <!-- Oplegging links (scharnier) -->
  <polygon points="50,100 35,130 65,130" fill="none" stroke="#374151" stroke-width="2"/>
  <line x1="30" y1="133" x2="70" y2="133" stroke="#374151" stroke-width="2"/>
  <!-- Oplegging rechts (rol) -->
  <polygon points="550,100 535,130 565,130" fill="none" stroke="#374151" stroke-width="2"/>
  <circle cx="542" cy="135" r="5" fill="none" stroke="#374151" stroke-width="2"/>
  <circle cx="558" cy="135" r="5" fill="none" stroke="#374151" stroke-width="2"/>
  <line x1="530" y1="143" x2="570" y2="143" stroke="#374151" stroke-width="2"/>
  <!-- Verdeelde belasting -->
  <line x1="50" y1="50" x2="550" y2="50" stroke="#dc2626" stroke-width="1.5"/>
  <line x1="100" y1="50" x2="100" y2="95" stroke="#dc2626" stroke-width="1" marker-end="url(#arrowRed)"/>
  <line x1="175" y1="50" x2="175" y2="95" stroke="#dc2626" stroke-width="1" marker-end="url(#arrowRed)"/>
  <line x1="250" y1="50" x2="250" y2="95" stroke="#dc2626" stroke-width="1" marker-end="url(#arrowRed)"/>
  <line x1="325" y1="50" x2="325" y2="95" stroke="#dc2626" stroke-width="1" marker-end="url(#arrowRed)"/>
  <line x1="400" y1="50" x2="400" y2="95" stroke="#dc2626" stroke-width="1" marker-end="url(#arrowRed)"/>
  <line x1="475" y1="50" x2="475" y2="95" stroke="#dc2626" stroke-width="1" marker-end="url(#arrowRed)"/>
  <defs>
    <marker id="arrowRed" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#dc2626"/>
    </marker>
  </defs>
  <!-- Label belasting -->
  <text x="300" y="40" text-anchor="middle" font-size="13" fill="#dc2626" font-style="italic">q = 20 kN/m</text>
  <!-- Maat overspanning -->
  <line x1="50" y1="170" x2="550" y2="170" stroke="#6b7280" stroke-width="1" stroke-dasharray="4"/>
  <line x1="50" y1="160" x2="50" y2="180" stroke="#6b7280" stroke-width="1"/>
  <line x1="550" y1="160" x2="550" y2="180" stroke="#6b7280" stroke-width="1"/>
  <text x="300" y="190" text-anchor="middle" font-size="13" fill="#6b7280" font-style="italic">L = {{L}} mm</text>
  <!-- Profielnaam -->
  <text x="300" y="118" text-anchor="middle" font-size="12" fill="#1e40af" font-weight="bold">IPE 300</text>
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
