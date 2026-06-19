# Tiny Havoc

**A tiny living world you grow — then take apart.**

Tiny Havoc is a browser-based falling-sand / cellular-automata sandbox with two
moods. In **Build**, you grow a calm little ecosystem of soil, water, and life;
plants sprout and flower when watered, vines spread on their own. Flip to
**Destroy** and unleash fire, lava, lightning, wind, ice, fungus, and mites on
everything you made — then switch back and start again.

## Features

- **Pure-JS cellular automata** — a 200×150 cell world simulated every frame on
  an HTML5 canvas, no physics or game engine.
- **Two modes, one world** — Build (a soft dusk-green calm) and Destroy (a
  scorched ember intensity), each with its own palette, atmosphere, and sound.
- **Emergent behavior** — water soaks into porous ground, seeds sprout and
  flower when watered, lava meeting water turns to stone, fire races along
  anything flammable, mites gnaw through wood (and the moss and foliage on it).
- **Crafted micro-interactions** — a guided ghost-cursor intro that shows you
  how to play, brush sparks, a mode-transition flare and swell, and a flurry of
  hearts when you tap the heart.
- **Sample-based audio** — a distinct placement sound per element plus
  mode-switch cues.
- **Responsive & considerate** — works on phone and desktop, respects
  `prefers-reduced-motion`, and keeps controls keyboard-focusable.

## Tech

- **React** (a single functional component driven by refs — no per-frame
  re-render)
- **HTML5 Canvas** with `ImageData` and `image-rendering: pixelated`
- **Web Audio API**
- **Vite**

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints.

Build for production:

```bash
npm run build
npm run preview
```

## Credits

A small portfolio / makathon piece. Typefaces: [Silkscreen](https://fonts.google.com/specimen/Silkscreen)
and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono).
