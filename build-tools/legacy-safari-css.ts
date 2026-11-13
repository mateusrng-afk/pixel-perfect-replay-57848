/**
 * Makes the Tailwind v4 stylesheet work on Safari / iOS 15 (iPhone 7 and up)
 * without changing what modern browsers render.
 *
 * Tailwind v4 targets Safari 16.4+. On older Safari the page loses its colors
 * (oklch, color-mix) and, on 15.0–15.3, every style (cascade layers). This
 * step runs on the generated CSS in dev and build (Vite plugin below):
 *  1. adds `--name-rgb` channel variables next to opaque color variables;
 *  2. lowers syntax with Lightning CSS for Safari 15 (oklch -> lab, media
 *     range queries, nesting, -webkit- prefixes);
 *  3. adds `@supports not (color-mix)` rules that rebuild
 *     `color-mix(in oklab, var(--x) N%, transparent)` as `rgb(var(--x-rgb) / N%)`
 *     (the same color: mixing with transparent only scales alpha);
 *  4. adds `vh` fallbacks before `svh/dvh/lvh`;
 *  5. repeats every `@layer` block's rules, unlayered, inside
 *     `@supports not selector(:has(a))` so browsers without cascade layers
 *     (Safari < 15.4) still get the styles; browsers with `:has()` (all
 *     current ones) ignore the copy and keep the layered original.
 */
import postcss, { type AtRule, type ChildNode, type Container, type Declaration, type Rule } from "postcss";
import { transform } from "lightningcss";
import type { Plugin as VitePlugin } from "vite";

/** JS build target for the browser bundle: Safari/iOS 15 and equivalent engines. */
export const LEGACY_BUILD_TARGET = ["safari15", "ios15", "chrome87", "edge88", "firefox78"];

const v = (major: number, minor = 0) => (major << 16) | (minor << 8);
/** Same browsers in Lightning CSS form (CSS compile + final minify must not re-modernize the output). */
export const LIGHTNING_TARGETS = { safari: v(15), ios_saf: v(15), chrome: v(87), edge: v(88), firefox: v(78) };

export const NO_COLOR_MIX = "not (color: color-mix(in lab, red, red))";
export const NO_LAYERS = "not selector(:has(a))";

function num(token: string, percentScale: number): number {
  const t = token.trim();
  if (t === "none") return 0;
  if (t.endsWith("%")) return (parseFloat(t) / 100) * percentScale;
  if (t.endsWith("deg")) return parseFloat(t);
  return parseFloat(t);
}

/** oklch() string -> sRGB 0..255 channels, or null when not an opaque oklch literal. */
export function oklchToRgb(value: string): [number, number, number] | null {
  const m = /^oklch\(\s*([^\s/)]+)\s+([^\s/)]+)\s+([^\s/)]+)\s*(?:\/\s*([^\s)]+)\s*)?\)$/i.exec(value.trim());
  if (!m) return null;
  if (m[4] !== undefined && num(m[4], 1) < 1) return null;
  const L = num(m[1]!, 1);
  const C = num(m[2]!, 0.4);
  const h = (num(m[3]!, 1) * Math.PI) / 180;
  if ([L, C, h].some((x) => Number.isNaN(x))) return null;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const out = lin.map((x) => {
    const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  });
  return [out[0]!, out[1]!, out[2]!];
}

function hexToRgb(value: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorToRgb(value: string): [number, number, number] | null {
  const t = value.trim().toLowerCase();
  if (t === "black") return [0, 0, 0];
  if (t === "white") return [255, 255, 255];
  return oklchToRgb(t) ?? hexToRgb(t);
}

const COLOR_MIX_RE =
  /color-mix\(\s*in\s+(?:oklab|oklch|srgb|srgb-linear|lab|lch)\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*([\d.]+)%\s*,\s*transparent\s*\)/gi;

/** Rewrites every `color-mix(in X, var(--c) N%, transparent)` as `rgb(var(--c-rgb) / N%)`; null if any part can't be. */
export function colorMixFallback(value: string, rgbVars: ReadonlySet<string>): string | null {
  if (!/color-mix\(/i.test(value)) return null;
  let ok = true;
  const out = value.replace(COLOR_MIX_RE, (_all, name: string, pct: string) => {
    if (!rgbVars.has(name)) ok = false;
    return `rgb(var(${name}-rgb) / ${pct}%)`;
  });
  return ok && !/color-mix\(/i.test(out) ? out : null;
}

function addChannelVars(root: postcss.Root): void {
  const known = new Map<string, [number, number, number]>();
  root.walkDecls(/^--/, (decl) => {
    if (decl.prop.endsWith("-rgb")) return;
    let rgb = colorToRgb(decl.value);
    const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(decl.value.trim());
    if (!rgb && alias) rgb = known.get(alias[1]!) ?? null;
    if (!rgb) return;
    known.set(decl.prop, rgb);
    decl.cloneAfter({ prop: `${decl.prop}-rgb`, value: rgb.join(" ") });
  });
}

function rgbVarNames(root: postcss.Root): Set<string> {
  const names = new Set<string>();
  root.walkDecls(/^--.*-rgb$/, (d) => names.add(d.prop.slice(0, -4)));
  return names;
}

function ancestors(node: ChildNode): Container[] {
  const chain: Container[] = [];
  let p = node.parent;
  while (p && p.type !== "root") {
    chain.unshift(p as Container);
    p = (p as ChildNode).parent;
  }
  return chain;
}

function isColorMixSupports(n: Container): boolean {
  return n.type === "atrule" && (n as AtRule).name === "supports" && /color-mix/i.test((n as AtRule).params);
}

function addColorMixFallbacks(root: postcss.Root): void {
  const rgbVars = rgbVarNames(root);
  const byRule = new Map<Rule, Declaration[]>();
  root.walkDecls((decl) => {
    if (decl.parent?.type !== "rule") return;
    const fb = colorMixFallback(decl.value, rgbVars);
    if (!fb) return;
    const rule = decl.parent as Rule;
    const list = byRule.get(rule) ?? [];
    list.push(decl.clone({ value: fb }));
    byRule.set(rule, list);
  });
  for (const [rule, decls] of byRule) {
    const chain = ancestors(rule);
    const sIdx = chain.map(isColorMixSupports).lastIndexOf(true);
    const anchor: ChildNode = sIdx >= 0 ? (chain[sIdx] as unknown as ChildNode) : rule;
    let inner: ChildNode = rule.clone({ nodes: [] });
    (inner as Rule).append(decls);
    for (let i = chain.length - 1; i > sIdx; i--) {
      const wrap = (chain[i] as unknown as ChildNode).clone({ nodes: [] }) as AtRule | Rule;
      wrap.append(inner);
      inner = wrap;
    }
    const guard = postcss.atRule({ name: "supports", params: NO_COLOR_MIX });
    guard.append(inner);
    anchor.after(guard);
  }
}

function addViewportFallbacks(root: postcss.Root): void {
  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--") || !/\d(?:s|d|l)vh\b/.test(decl.value)) return;
    const prev = decl.prev();
    const fb = decl.value.replace(/(\d)(?:s|d|l)vh\b/g, "$1vh");
    if (prev?.type === "decl" && prev.prop === decl.prop && prev.value === fb) return;
    decl.cloneBefore({ value: fb });
  });
}

function flattenLayers(nodes: ChildNode[]): ChildNode[] {
  const out: ChildNode[] = [];
  for (const n of nodes) {
    if (n.type === "atrule" && n.name === "layer") {
      if (n.nodes) out.push(...flattenLayers(n.nodes));
    } else if (n.type === "atrule" || n.type === "rule") {
      const c = n.clone({ nodes: [] });
      if (n.nodes) c.append(flattenLayers(n.nodes));
      out.push(c);
    } else {
      out.push(n.clone());
    }
  }
  return out;
}

function addUnlayeredCopies(root: postcss.Root): void {
  const blocks: AtRule[] = [];
  root.each((n) => {
    if (n.type === "atrule" && n.name === "layer" && n.nodes && n.nodes.length) blocks.push(n);
  });
  for (const block of blocks) {
    const guard = postcss.atRule({ name: "supports", params: NO_LAYERS });
    guard.append(flattenLayers(block.nodes ?? []));
    block.after(guard);
  }
}

/** Full pipeline on a CSS string; exported for tests and offline checks. */
export function lowerCssForLegacySafari(css: string, filename = "styles.css"): string {
  const first = postcss.parse(css);
  addChannelVars(first);
  const lowered = transform({
    filename,
    code: Buffer.from(first.toString()),
    minify: false,
    errorRecovery: true,
    targets: LIGHTNING_TARGETS,
  }).code.toString();
  const root = postcss.parse(lowered);
  addColorMixFallbacks(root);
  addViewportFallbacks(root);
  addUnlayeredCopies(root);
  return root.toString();
}

const NEEDS_WORK = /@layer|oklch|color-mix|[sdl]vh\b|@media[^{]*[<>]=?/;

const CSS_ID = /\.css(?:$|\?)/;
const SKIP_QUERY = /[?&](?:raw|inline-css|html-proxy)\b/;

/**
 * Vite plugin. The project compiles CSS with Lightning CSS (not PostCSS), so this
 * runs as a normal-order transform: after Tailwind and Vite's CSS compile, before
 * the stylesheet is bundled, hashed and minified.
 */
export function legacySafariCss(): VitePlugin {
  return {
    name: "legacy-safari-css",
    transform(code, id) {
      if (!CSS_ID.test(id) || SKIP_QUERY.test(id) || !NEEDS_WORK.test(code)) return null;
      return { code: lowerCssForLegacySafari(code, id.split("?")[0]), map: null };
    },
  };
}
