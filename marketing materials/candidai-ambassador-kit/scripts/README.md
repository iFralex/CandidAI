# CandidAI Ambassador Kit — generation scripts

Print-ready SVG generators for all kit materials.

## Requirements
```bash
pip install qrcode
```
Keep `logo.png` (transparent background) in the same folder as the scripts.

## Usage
```bash
python3 generate.py    # stickers, cards, flyer, letters, post-its, diploma, instruction sheet
python3 make_holo.py   # holographic collectible sticker
```
All files are written to `out/`.

## What generate.py produces
| File | Size | Notes |
|---|---|---|
| sticker-01..05.svg | 106 x 40 mm | die-cut, QR + copy; 01-02 are the bathroom designs |
| sticker-round-small.svg | 48 x 48 mm | magnifier-shaped die-cut (custom outline) |
| card-qr-front/back.svg | 85 x 55 mm | "recruiter who ghosted you" concept |
| flyer-tear-tabs.svg | A4 | fake job posting, 8 tear-off tabs |
| rejection-letter-01..03.svg | A4 | fake corporate letters (intentionally unbranded) |
| letter-special.svg | A4 | the CandidAI reply for the rejection wall |
| post-it.svg, post-it-02.svg | 76 x 76 mm | intentionally unbranded |
| diploma.svg | A4 landscape | Master's in Ignored Applications |
| instruction-sheet.svg | A4 | dark field manual |

## Customizing
- **Palette / fonts / URL**: constants at the top of each script.
- **Sticker copy**: edit the `STICKERS` list; font auto-fits to the longest line.
- **Per-ambassador QR codes**: change `QR_URL` and re-run, or loop over a list of
  codes calling the generators per ambassador (`candidai.tech/r/<CODE>`).

## Print notes
- SVG is vector: scales to any size (flyer/diploma work at A1-A0 too).
- QR codes are real and scannable; replace the placeholder URL before production.
- Magnifier sticker: order as "custom die-cut on path" and attach the SVG.
- Holographic sticker: print on holographic vinyl with **selective white ink** —
  no white underbase on the gradient areas (raw foil shows through), full white
  under the black/white artwork. Ask the print shop for a proof.
- Convert text to outlines (or export PDF/X) before sending to print if the shop
  doesn't have Arial/Georgia/Courier equivalents.
