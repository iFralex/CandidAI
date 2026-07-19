#!/usr/bin/env python3
"""CandidAI — A3 career-day sign (297 x 420 mm, portrait).

"The queue for this booth: 2 hours. An email to the right recruiter: 2 minutes."
Foldable sign for the career fair mission. Requires logo.png next to the script.

Usage: python3 make_sign.py  ->  out/career-day-sign.svg
"""
import base64, html, os
import qrcode

VIOLET = "#8B5CF6"; VIOLETD = "#7C3AED"; VIOLETL = "#A78BFA"
FUCHSIA = "#E879F9"; WHITE = "#FFFFFF"; BLACK = "#000000"; DARK = "#080510"
G300 = "#D1D5DB"; G500 = "#6B7280"
DISPLAY = "Arial, 'Helvetica Neue', sans-serif"

BASE = os.path.dirname(os.path.abspath(__file__))
QR_URL = "https://candidai.tech/r/AMB-001"
LOGO_B64 = base64.b64encode(open(os.path.join(BASE, "logo.png"), "rb").read()).decode()

def qr_group(x, y, size, fg, bg=None, quiet=1):
    q = qrcode.QRCode(border=0, box_size=1,
                      error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(QR_URL); q.make(fit=True)
    m = q.get_matrix(); n = len(m)
    cell = size / (n + 2 * quiet)
    parts = []
    if bg:
        parts.append(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{bg}" rx="{size*0.04}"/>')
    for r in range(n):
        c = 0
        while c < n:
            if m[r][c]:
                run = 0
                while c + run < n and m[r][c + run]:
                    run += 1
                parts.append(f'<rect x="{x+(c+quiet)*cell:.2f}" y="{y+(r+quiet)*cell:.2f}" '
                             f'width="{run*cell:.2f}" height="{cell:.2f}" fill="{fg}"/>')
                c += run
            else:
                c += 1
    return "".join(parts)

def T(x, y, s, size, fill, weight="normal", anchor="start", spacing=0):
    return (f'<text x="{x}" y="{y}" font-family="{DISPLAY}" font-size="{size}" '
            f'fill="{fill}" font-weight="{weight}" text-anchor="{anchor}" '
            f'letter-spacing="{spacing}">{html.escape(s)}</text>')

W, H = 2970, 4200  # A3 portrait, 10 units/mm
b = [f'<rect width="{W}" height="{H}" fill="{DARK}"/>',
     f'<rect x="70" y="70" width="{W-140}" height="{H-140}" fill="none" '
     f'stroke="{VIOLET}" stroke-width="10"/>']

cx = W / 2

# ---- block 1: the queue ----
b.append(T(cx, 560, "THE QUEUE FOR", 190, WHITE, weight="900", anchor="middle"))
b.append(T(cx, 790, "THIS BOOTH:", 190, WHITE, weight="900", anchor="middle"))
b.append(T(cx, 1310, "2 HOURS.", 430, G300, weight="900", anchor="middle"))

# divider
b.append(f'<rect x="{cx-260}" y="1520" width="520" height="16" fill="{VIOLET}"/>')

# ---- block 2: the email ----
b.append(T(cx, 1880, "AN EMAIL TO THE", 190, WHITE, weight="900", anchor="middle"))
b.append(T(cx, 2110, "RIGHT RECRUITER:", 190, WHITE, weight="900", anchor="middle"))
b.append(T(cx, 2650, "2 MINUTES.", 430, FUCHSIA, weight="900", anchor="middle"))

# ---- kicker ----
b.append(T(cx, 2960, "Same companies. Zero queue.", 110, VIOLETL, anchor="middle"))

# ---- QR panel ----
qs = 560
b.append(qr_group(cx - qs/2, 3130, qs, BLACK, bg=WHITE))
b.append(T(cx, 3820, "Scan while you wait.", 96, WHITE, weight="bold", anchor="middle"))

# ---- footer: logo + url ----
b.append(f'<image x="{cx-390}" y="3910" width="170" height="170" '
         f'href="data:image/png;base64,{LOGO_B64}" preserveAspectRatio="xMidYMid meet"/>')
b.append(T(cx - 180, 4025, "candidai.tech", 120, VIOLET, weight="900", spacing="2"))

os.makedirs(os.path.join(BASE, "out"), exist_ok=True)
doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" '
       f'viewBox="0 0 {W} {H}">' + "".join(b) + '</svg>')
open(os.path.join(BASE, "out", "career-day-sign.svg"), "w").write(doc)
print("wrote out/career-day-sign.svg")
