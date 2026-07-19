#!/usr/bin/env python3
"""CandidAI — holographic collectible sticker (55x55mm circular badge).

Skull with graduation cap on iridescent burst rays.
PRINT NOTE: gradient areas simulate the holographic foil — in production,
print with selective white ink: NO white underbase on gradient zones
(the raw holo vinyl shows through there), full white under black/white art.

Usage: python3 make_holo.py  ->  out/sticker-holo.svg
"""
import math, os

VIOLET = "#8B5CF6"; VIOLETD = "#7C3AED"; VIOLETL = "#A78BFA"
FUCHSIA = "#E879F9"; CYAN = "#67E8F9"; PINK = "#F472B6"
WHITE = "#FFFFFF"; BLACK = "#000000"; DARK = "#080510"

S = 550; c = 275
b = []

b.append(f'''<defs>
<linearGradient id="holoA" x1="0%" y1="0%" x2="100%" y2="100%">
 <stop offset="0%" stop-color="{VIOLETL}"/><stop offset="35%" stop-color="{FUCHSIA}"/>
 <stop offset="70%" stop-color="{CYAN}"/><stop offset="100%" stop-color="{VIOLETL}"/></linearGradient>
<linearGradient id="holoB" x1="100%" y1="0%" x2="0%" y2="100%">
 <stop offset="0%" stop-color="{CYAN}"/><stop offset="40%" stop-color="{VIOLET}"/>
 <stop offset="75%" stop-color="{PINK}"/><stop offset="100%" stop-color="{FUCHSIA}"/></linearGradient>
<path id="arcTop" d="M 62 275 A 213 213 0 0 1 488 275" fill="none"/>
<path id="arcBot" d="M 38 275 A 237 237 0 0 0 512 275" fill="none"/>
<path id="bannerArc" d="M 110 389 Q 275 431 440 389" fill="none"/>
</defs>''')

# die-cut edge + outer dark ring
b.append(f'<circle cx="{c}" cy="{c}" r="273" fill="{WHITE}"/>')
b.append(f'<circle cx="{c}" cy="{c}" r="260" fill="{DARK}"/>')

# inner holo disc with burst rays
b.append(f'<circle cx="{c}" cy="{c}" r="192" fill="url(#holoA)"/>')
for i in range(16):
    a0 = i * 22.5; a1 = a0 + 11.25
    x0 = c + 192 * math.cos(math.radians(a0)); y0 = c + 192 * math.sin(math.radians(a0))
    x1 = c + 192 * math.cos(math.radians(a1)); y1 = c + 192 * math.sin(math.radians(a1))
    b.append(f'<path d="M {c} {c} L {x0:.1f} {y0:.1f} A 192 192 0 0 1 {x1:.1f} {y1:.1f} Z" '
             f'fill="url(#holoB)" opacity="0.85"/>')
b.append(f'<circle cx="{c}" cy="{c}" r="192" fill="none" stroke="{WHITE}" stroke-width="6"/>')

# ---- skull ----
b.append(f'<path d="M 195 235 Q 195 130 275 130 Q 355 130 355 235 Q 355 275 335 292 L 335 318 '
         f'Q 335 332 320 332 L 230 332 Q 215 332 215 318 L 215 292 Q 195 275 195 235 Z" '
         f'fill="{WHITE}" stroke="{BLACK}" stroke-width="7"/>')
b.append(f'<ellipse cx="243" cy="240" rx="24" ry="28" fill="{BLACK}"/>')
b.append(f'<ellipse cx="307" cy="240" rx="24" ry="28" fill="{BLACK}"/>')
b.append(f'<circle cx="248" cy="247" r="7" fill="{VIOLET}"/>')
b.append(f'<circle cx="302" cy="247" r="7" fill="{VIOLET}"/>')
b.append(f'<path d="M 275 268 L 263 296 Q 275 304 287 296 Z" fill="{BLACK}"/>')
for tx in [238, 258, 278, 298]:
    b.append(f'<rect x="{tx}" y="332" width="16" height="24" rx="5" fill="{WHITE}" '
             f'stroke="{BLACK}" stroke-width="6"/>')
b.append(f'<path d="M 322 160 L 332 180 L 322 196" stroke="{BLACK}" stroke-width="6" '
         f'fill="none" stroke-linecap="round"/>')

# ---- graduation cap ----
b.append(f'<path d="M 275 88 L 388 138 L 275 176 L 162 138 Z" fill="{BLACK}" stroke="{BLACK}" stroke-width="4"/>')
b.append(f'<path d="M 214 155 L 214 190 Q 275 212 336 190 L 336 155" fill="{BLACK}"/>')
b.append(f'<circle cx="275" cy="132" r="8" fill="{VIOLET}"/>')
b.append(f'<path d="M 275 132 Q 360 150 372 216" stroke="{VIOLET}" stroke-width="8" fill="none" stroke-linecap="round"/>')
b.append(f'<circle cx="372" cy="228" r="14" fill="{VIOLET}"/>')

# ---- ribbon banner ----
b.append(f'<path d="M 112 352 L 82 396 L 112 392 L 120 424 L 162 386 Z" fill="{VIOLET}"/>')
b.append(f'<path d="M 438 352 L 468 396 L 438 392 L 430 424 L 388 386 Z" fill="{VIOLET}"/>')
b.append(f'<path d="M 122 356 Q 275 396 428 356 L 428 402 Q 275 442 122 402 Z" '
         f'fill="{BLACK}" stroke="{WHITE}" stroke-width="5"/>')
b.append(f'<text font-family="Arial, sans-serif" font-size="25" font-weight="900" fill="{WHITE}" '
         f'letter-spacing="1"><textPath href="#bannerArc" startOffset="50%" text-anchor="middle">'
         f'CLASS OF NO REPLIES</textPath></text>')

# ---- curved ring text ----
b.append(f'<text font-family="Arial, sans-serif" font-size="31" font-weight="900" fill="{WHITE}" '
         f'letter-spacing="4"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">'
         f'AS RARE AS A REPLY FROM HR</textPath></text>')
b.append(f'<text font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="{VIOLETL}" '
         f'letter-spacing="3"><textPath href="#arcBot" startOffset="50%" text-anchor="middle">'
         f'\u2022  candidai.tech  \u2022</textPath></text>')

os.makedirs("out", exist_ok=True)
doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="55mm" height="55mm" '
       f'viewBox="0 0 {S} {S}">' + "".join(b) + '</svg>')
open("out/sticker-holo.svg", "w").write(doc)
print("wrote out/sticker-holo.svg")
