# Ifc-Calc

Lightweight CalcPAD alternative — een TypeScript-gebaseerde rekenmodule voor constructieve berekeningen. Werkt als standalone web-app én als integreerbare library voor FEM-applicaties (normtoetsingen).

## Features

- **Formules met eenheden** — mm, kN, N/mm², mm⁴ etc. via mathjs
- **Automatische unit-simplificatie** — `b*h` geeft direct `mm²`, geen `to` nodig
- **Wiskundige opmaak** — KaTeX rendering met echte breuken, superscripts, Griekse letters
- **Formule-keten** — toont `naam = formule = ingevulde waarden = resultaat`
- **SVG tekeningen** — parametrische tekeningen met `{{variabele}}` interpolatie
- **Conditionals** — `#if` / `#else` / `#end if` voor toetsingen
- **Live preview** — split-pane editor met CodeMirror en debounced preview

## Projectstructuur

```
Ifc-Calc/
├── packages/
│   ├── core/                 # @ifc-calc/core — rekenengine (npm library)
│   │   ├── src/
│   │   │   ├── parser.ts     # Document parser (line-based syntax)
│   │   │   ├── evaluator.ts  # Expressie-evaluator (mathjs wrapper)
│   │   │   ├── latex.ts      # Expressie → LaTeX converter
│   │   │   ├── renderer.ts   # HTML output renderer (KaTeX)
│   │   │   ├── types.ts      # Shared types
│   │   │   └── index.ts      # Public API
│   │   └── package.json
│   └── web/                  # @ifc-calc/web — browser app
│       ├── src/
│       │   ├── main.ts       # App entry + voorbeeld document
│       │   ├── editor.ts     # CodeMirror editor
│       │   └── preview.ts    # Live preview
│       ├── index.html
│       └── package.json
├── package.json              # npm workspaces root
└── tsconfig.base.json
```

## Document Syntax

```
# Heading

Beschrijvende tekst.

b = 300 mm
h = 500 mm
A = b*h

sigma = F / A to N/mm^2

#if sigma < f_cd
  Voldoet.
#else
  Voldoet NIET!
#end if

@svg
<svg width="400" height="300">
  <rect width="{{b}}" height="{{h}}" />
</svg>
@end

@img(pad/naar/afbeelding.png)
```

## Installatie

```bash
npm install
```

## Ontwikkeling

```bash
# Core package bouwen
npm run build --workspace=@ifc-calc/core

# Web app starten (dev server)
npm run dev --workspace=@ifc-calc/web
```

## Gebruik als library

```typescript
import { process } from '@ifc-calc/core';

const html = process(`
b = 300 mm
h = 500 mm
A = b*h
`);
// html bevat gerenderde KaTeX formules
```

## Tech Stack

- **mathjs** — expressie-parsing, eenheden, matrices
- **KaTeX** — wiskundige opmaak
- **CodeMirror 6** — editor met syntax highlighting
- **Vite** — bundler
- **npm workspaces** — monorepo
