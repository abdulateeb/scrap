"use client";

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Surfaces for the belt scene, drawn on a canvas rather than downloaded.
 *
 * Photographs of real waste would look more real still, but every one carries a
 * licence and a hotlink, and the scene is meant to render the same on a plane
 * with no network. These are painted instead: corrugation for board, print for
 * paper, a brushed grain for metal, ribbing for a bottle. They are cheap, they
 * tile, and they read as material rather than as coloured plastic toys.
 *
 * Everything here touches the canvas API, so it must only run in the browser.
 */

const SIZE = 256;

/** The material colours the rest of the interface uses, as literals three can read. */
export const MATERIAL_COLOURS = {
  plastic: "#2f7fcc",
  paper: "#a8860f",
  cardboard: "#a2662c",
  metal: "#67768a",
  glass: "#10998a",
  organic: "#4e9330",
  textiles: "#9c3f9c",
  ewaste: "#d9551f",
  other: "#6b736b",
} as const;

export type Painted = keyof typeof MATERIAL_COLOURS;

/** A small deterministic generator, so a surface looks the same every reload. */
function rng(seed: number) {
  let value = seed * 9301 + 49297;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = SIZE;
  element.height = SIZE;
  return [element, element.getContext("2d") as CanvasRenderingContext2D];
}

function finish(element: HTMLCanvasElement, repeat = 1): Texture {
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

/** Scatter dirt and scuffs. Nothing on a sorting line is clean. */
function soil(context: CanvasRenderingContext2D, seed: number, amount = 90) {
  const next = rng(seed);
  for (let i = 0; i < amount; i += 1) {
    const x = next() * SIZE;
    const y = next() * SIZE;
    const r = 1 + next() * 5;
    context.fillStyle = `rgba(60,48,36,${0.04 + next() * 0.12})`;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
}

/** Corrugated board: kraft brown, flute lines, worn edges. */
export function cardboardTexture(): Texture {
  const [element, context] = canvas();
  context.fillStyle = "#9d6f42";
  context.fillRect(0, 0, SIZE, SIZE);

  // Flutes running one way, which is what makes board read as board. Tight
  // enough that they still show once the texture is on a small face, otherwise
  // a flattened carton just looks like a plank of wood.
  for (let y = 0; y < SIZE; y += 5) {
    context.fillStyle = "rgba(94,64,34,0.38)";
    context.fillRect(0, y, SIZE, 2);
    context.fillStyle = "rgba(206,166,116,0.26)";
    context.fillRect(0, y + 2, SIZE, 1);
  }

  // A taped seam across the middle, like a closed carton.
  context.fillStyle = "rgba(178,158,124,0.5)";
  context.fillRect(0, SIZE / 2 - 6, SIZE, 12);

  soil(context, 7, 140);
  return finish(element, 2);
}

/** Newsprint: off white with lines of type and a darker masthead band. */
export function paperTexture(): Texture {
  const [element, context] = canvas();
  context.fillStyle = "#efe9dc";
  context.fillRect(0, 0, SIZE, SIZE);

  const next = rng(21);
  context.fillStyle = "rgba(58,54,48,0.42)";
  for (let y = 26; y < SIZE - 10; y += 9) {
    // Ragged line ends read as text far better than full width bars.
    const indent = next() * 18;
    const width = SIZE - indent - 14 - next() * 40;
    context.fillRect(8 + indent, y, width, 2.5);
  }

  context.fillStyle = "rgba(40,38,34,0.72)";
  context.fillRect(10, 8, SIZE - 20, 9);

  soil(context, 13, 60);
  return finish(element);
}

/** Aluminium: a brushed vertical grain with a printed band around the middle. */
export function metalTexture(): Texture {
  const [element, context] = canvas();
  const sheen = context.createLinearGradient(0, 0, SIZE, 0);
  sheen.addColorStop(0, "#8d959d");
  sheen.addColorStop(0.35, "#dfe4e8");
  sheen.addColorStop(0.55, "#aab2ba");
  sheen.addColorStop(1, "#7e868e");
  context.fillStyle = sheen;
  context.fillRect(0, 0, SIZE, SIZE);

  const next = rng(37);
  for (let i = 0; i < 400; i += 1) {
    const x = next() * SIZE;
    context.strokeStyle = `rgba(255,255,255,${next() * 0.13})`;
    context.lineWidth = next() * 1.6;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, SIZE);
    context.stroke();
  }

  // The label band, so a can looks like a drink can and not a pipe.
  context.fillStyle = MATERIAL_COLOURS.ewaste;
  context.globalAlpha = 0.85;
  context.fillRect(0, SIZE * 0.3, SIZE, SIZE * 0.36);
  context.globalAlpha = 1;
  context.fillStyle = "rgba(255,255,255,0.75)";
  context.fillRect(SIZE * 0.12, SIZE * 0.44, SIZE * 0.3, 7);

  soil(context, 41, 40);
  return finish(element);
}

/** A drinks bottle: pale plastic, vertical ribs, a wrapped label. */
export function plasticTexture(): Texture {
  const [element, context] = canvas();
  context.fillStyle = "#cfe4f2";
  context.fillRect(0, 0, SIZE, SIZE);

  for (let x = 0; x < SIZE; x += 11) {
    context.fillStyle = "rgba(255,255,255,0.55)";
    context.fillRect(x, 0, 3, SIZE);
    context.fillStyle = "rgba(120,160,190,0.30)";
    context.fillRect(x + 4, 0, 2, SIZE);
  }

  context.fillStyle = MATERIAL_COLOURS.plastic;
  context.fillRect(0, SIZE * 0.34, SIZE, SIZE * 0.3);
  context.fillStyle = "rgba(255,255,255,0.8)";
  context.fillRect(SIZE * 0.1, SIZE * 0.42, SIZE * 0.36, 8);
  context.fillRect(SIZE * 0.1, SIZE * 0.53, SIZE * 0.22, 5);

  soil(context, 53, 35);
  return finish(element);
}

/** Bottle glass: deep green with a wet highlight down one side. */
export function glassTexture(): Texture {
  const [element, context] = canvas();
  const body = context.createLinearGradient(0, 0, SIZE, 0);
  body.addColorStop(0, "#16624f");
  body.addColorStop(0.3, "#2f9c78");
  body.addColorStop(0.45, "#bff0dc");
  body.addColorStop(0.6, "#2f9c78");
  body.addColorStop(1, "#124f42");
  context.fillStyle = body;
  context.fillRect(0, 0, SIZE, SIZE);

  context.fillStyle = "rgba(240,240,225,0.85)";
  context.fillRect(SIZE * 0.3, SIZE * 0.36, SIZE * 0.4, SIZE * 0.2);

  soil(context, 67, 30);
  return finish(element);
}

/** Food waste and garden waste: mottled, wet, no straight lines anywhere. */
export function organicTexture(): Texture {
  const [element, context] = canvas();
  context.fillStyle = "#5c6b34";
  context.fillRect(0, 0, SIZE, SIZE);

  const next = rng(83);
  for (let i = 0; i < 220; i += 1) {
    const shade = ["#6f8040", "#43502a", "#84713a", "#39461f"][
      Math.floor(next() * 4)
    ];
    context.fillStyle = shade;
    context.globalAlpha = 0.35 + next() * 0.5;
    context.beginPath();
    context.ellipse(
      next() * SIZE,
      next() * SIZE,
      3 + next() * 16,
      3 + next() * 12,
      next() * Math.PI,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;
  return finish(element);
}

/** Bagged film and fabric: creased sheet with soft folds. */
export function filmTexture(): Texture {
  const [element, context] = canvas();
  context.fillStyle = "#d9dde0";
  context.fillRect(0, 0, SIZE, SIZE);

  const next = rng(97);
  for (let i = 0; i < 26; i += 1) {
    context.strokeStyle = `rgba(255,255,255,${0.25 + next() * 0.5})`;
    context.lineWidth = 1 + next() * 3;
    context.beginPath();
    const x = next() * SIZE;
    context.moveTo(x, 0);
    context.bezierCurveTo(
      x + (next() - 0.5) * 90,
      SIZE * 0.35,
      x + (next() - 0.5) * 90,
      SIZE * 0.7,
      x + (next() - 0.5) * 50,
      SIZE,
    );
    context.stroke();
  }
  soil(context, 101, 45);
  return finish(element);
}

/** The belt itself: dark rubber with a fine weave and a worn centre track. */
export function beltTexture(): Texture {
  const [element, context] = canvas();
  context.fillStyle = "#4a3527";
  context.fillRect(0, 0, SIZE, SIZE);

  const next = rng(11);
  for (let i = 0; i < 2600; i += 1) {
    const grey = next();
    context.fillStyle = `rgba(${grey > 0.5 ? "255,240,225" : "20,12,6"},${
      0.03 + next() * 0.07
    })`;
    context.fillRect(next() * SIZE, next() * SIZE, 2, 2);
  }

  // The middle of a belt polishes where the load rides.
  const wear = context.createLinearGradient(0, 0, SIZE, 0);
  wear.addColorStop(0, "rgba(0,0,0,0.22)");
  wear.addColorStop(0.5, "rgba(255,220,190,0.10)");
  wear.addColorStop(1, "rgba(0,0,0,0.22)");
  context.fillStyle = wear;
  context.fillRect(0, 0, SIZE, SIZE);

  return finish(element, 2);
}

/**
 * A detection chip, drawn the way the interface draws one.
 *
 * Text is painted onto a canvas rather than rendered with a 3D font, because
 * the usual font loaders reach for a typeface over the network and this scene
 * is meant to work without one.
 */
export function labelTexture(
  label: string,
  percent: number,
  colour: string,
): { texture: Texture; aspect: number } {
  const height = 128;
  const nameFont = "600 46px ui-sans-serif, system-ui, sans-serif";
  const readingFont = "500 40px ui-monospace, monospace";
  const reading = `${percent}%`;

  // Measure first, then size the canvas to the text. A fixed width either
  // clipped the longer names or left a slab of empty chip after the short ones.
  const ruler = document
    .createElement("canvas")
    .getContext("2d") as CanvasRenderingContext2D;
  ruler.font = nameFont;
  const nameWidth = ruler.measureText(label).width;
  ruler.font = readingFont;
  const readingWidth = ruler.measureText(reading).width;

  const dotLeft = 26;
  const dotRadius = 13;
  const gap = 18;
  const width = Math.ceil(
    dotLeft + dotRadius * 2 + gap + nameWidth + gap + readingWidth + 26,
  );

  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d") as CanvasRenderingContext2D;

  context.fillStyle = "rgba(12,17,11,0.88)";
  context.beginPath();
  context.roundRect(2, 20, width - 4, height - 40, 22);
  context.fill();
  context.strokeStyle = colour;
  context.lineWidth = 4;
  context.stroke();

  context.fillStyle = colour;
  context.beginPath();
  context.arc(dotLeft + dotRadius, height / 2, dotRadius, 0, Math.PI * 2);
  context.fill();

  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.font = nameFont;
  context.fillText(label, dotLeft + dotRadius * 2 + gap, height / 2 + 1);

  context.font = readingFont;
  context.fillStyle = "rgba(255,255,255,0.75)";
  context.fillText(reading, width - readingWidth - 26, height / 2 + 1);

  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / height };
}
