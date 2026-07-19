#!/usr/bin/env python3
# CandidAI Ambassador Kit — print-ready SVG generator
import qrcode, html, os

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "out")
os.makedirs(OUT, exist_ok=True)

# ---------- Palette ----------
BLACK   = "#000000"
DARK    = "#080510"
VIOLET  = "#8B5CF6"
VIOLETD = "#7C3AED"
VIOLETL = "#A78BFA"
VTEXT   = "#C4B5FD"
FUCHSIA = "#E879F9"
WHITE   = "#FFFFFF"
G300    = "#D1D5DB"
G400    = "#9CA3AF"
G500    = "#6B7280"
IVORY   = "#F4EFE3"
POSTIT  = "#FDE68A"

DISPLAY = "Arial, 'Helvetica Neue', sans-serif"
MONO    = "'Courier New', Courier, monospace"
SERIF   = "Georgia, 'Times New Roman', serif"
SCRIPT  = "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive"

QR_URL = "https://candidai.tech/r/AMB-001"
import base64 as _b64
LOGO_B64 = _b64.b64encode(open(os.path.join(BASE, "logo.png"), "rb").read()).decode()
def logo_img(x, y, size):
    return (f'<image x="{x}" y="{y}" width="{size}" height="{size}" '
            f'href="data:image/png;base64,{LOGO_B64}" preserveAspectRatio="xMidYMid meet"/>')

# ---------- QR helper ----------
def qr_group(x, y, size, fg, bg=None, url=QR_URL, quiet=1):
    q = qrcode.QRCode(border=0, box_size=1,
                      error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url); q.make(fit=True)
    m = q.get_matrix(); n = len(m)
    total = n + 2*quiet
    cell = size / total
    parts = []
    if bg:
        parts.append(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{bg}" rx="{size*0.04}"/>')
    for r in range(n):
        c = 0
        while c < n:
            if m[r][c]:
                run = 0
                while c+run < n and m[r][c+run]:
                    run += 1
                parts.append(f'<rect x="{x+(c+quiet)*cell:.2f}" y="{y+(r+quiet)*cell:.2f}" '
                             f'width="{run*cell:.2f}" height="{cell:.2f}" fill="{fg}"/>')
                c += run
            else:
                c += 1
    return "".join(parts)

def svg(name, w_mm, h_mm, body):
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w_mm}mm" height="{h_mm}mm" '
           f'viewBox="0 0 {w_mm*10} {h_mm*10}">{body}</svg>')
    with open(f"{OUT}/{name}.svg", "w") as f:
        f.write(doc)
    print("wrote", name)

def T(x, y, s, size, fill, font=DISPLAY, weight="normal", anchor="start",
      spacing=0, style=""):
    return (f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" '
            f'fill="{fill}" font-weight="{weight}" text-anchor="{anchor}" '
            f'letter-spacing="{spacing}" style="{style}">{html.escape(s)}</text>')

# =========================================================
# 1. STICKERS — 100 x 60 mm, die-cut rounded
# =========================================================
STICKERS = [
    ("sticker-01", ["YOU'LL FINISH PISSING", "BEFORE A RECRUITER", "EVEN OPENS YOUR CV."]),
    ("sticker-02", ["THIS TOILET HANDLES", "YOUR SHIT BETTER THAN", "THE JOB MARKET DOES."]),
    ("sticker-03", ["AN ALGORITHM IS", "FLUSHING YOUR CV", "RIGHT NOW."]),
    ("sticker-04", ["500 APPLICATIONS.", "0 REPLIES.", "YOU'RE NOT THE PROBLEM.", "YOUR STRATEGY IS."]),
    ("sticker-05", ["THE ATS REJECTED YOU", "IN 0.3 SECONDS.", "THIS STICKER", "RESPECTS YOU MORE."]),
]

for name, lines in STICKERS:
    W, H = 1060, 400
    b = []
    b.append(f'<rect x="0" y="0" width="{W}" height="{H}" rx="46" fill="{WHITE}"/>')
    b.append(f'<rect x="14" y="14" width="{W-28}" height="{H-28}" rx="36" fill="{BLACK}"/>')
    qs = 200
    colx, colw = 58, 214
    qy = 62
    b.append(qr_group(colx + (colw-qs)/2, qy, qs, BLACK, bg=WHITE))
    b.append(T(colx + colw/2, qy + qs + 46, "candidai.tech", 33, VIOLETL, weight="bold", anchor="middle", spacing="1"))
    b.append(f'<rect x="300" y="54" width="13" height="{H-108}" fill="{VIOLET}"/>')
    tx = 352
    avail = W - 55 - tx
    maxchars = max(len(l) for l in lines)
    fs = min(80, int(avail / (maxchars * 0.60)))
    n = len(lines)
    lh = fs * 1.16
    y0 = (H - lh*(n-1)) / 2 + fs*0.36
    for i, ln in enumerate(lines):
        col = FUCHSIA if i == n-1 else WHITE
        b.append(T(tx, y0 + i*lh, ln, fs, col, weight="900", spacing="-1"))
    svg(name, 106, 40, "".join(b))

# magnifier die-cut sticker — ~48 x 48 mm, shaped like the brand mark
W = H = 480
cx, cy, r = 210, 210, 180
b = []
# die-cut white edge: lens + handle
b.append(f'<circle cx="{cx}" cy="{cy}" r="{r+16}" fill="{WHITE}"/>')
b.append(f'<g transform="rotate(-45 {cx} {cy})">'
         f'<rect x="{cx-30}" y="{cy+r-10}" width="60" height="240" rx="30" fill="{WHITE}"/></g>')
# handle (violet, on top of white die edge)
b.append(f'<g transform="rotate(-45 {cx} {cy})">'
         f'<rect x="{cx-19}" y="{cy+r-6}" width="38" height="222" rx="19" fill="{VIOLETD}"/></g>')
# lens: violet ring + dark glass
b.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{VIOLET}"/>')
b.append(f'<circle cx="{cx}" cy="{cy}" r="{r-24}" fill="{DARK}"/>')
# subtle glass highlight
b.append(f'<path d="M 104 142 A 128 128 0 0 1 192 74" stroke="{WHITE}" stroke-width="9" fill="none" opacity="0.25" stroke-linecap="round"/>')
# text inside the lens
b.append(T(cx, 176, "WE SEE YOU.", 44, WHITE, weight="900", anchor="middle"))
b.append(T(cx, 236, "RECRUITERS", 42, FUCHSIA, weight="900", anchor="middle"))
b.append(T(cx, 288, "DON'T.", 42, FUCHSIA, weight="900", anchor="middle"))
b.append(T(cx, 336, "candidai.tech", 23, VIOLETL, weight="bold", anchor="middle", spacing="1"))
svg("sticker-round-small", 48, 48, "".join(b))

# =========================================================
# 2. CARD QR — 85 x 55 mm — "the recruiter who ghosted you"
# =========================================================
W, H = 850, 550
# FRONT: fake corporate recruiter card, crossed out, stamped
b = [f'<rect width="{W}" height="{H}" rx="24" fill="{WHITE}"/>',
     f'<rect width="{W}" height="{H}" rx="24" fill="none" stroke="#E5E7EB" stroke-width="3"/>']
b.append(T(80, 145, "SOME RECRUITER", 58, "#374151", font=SERIF, weight="bold", spacing="2"))
b.append(T(80, 210, "Talent Acquisition Lead \u2014 Big Corp Inc.", 34, G500, font=SERIF, style="font-style:italic"))
b.append(T(80, 285, "someone@bigcorp.com", 32, G400, font=MONO))
b.append(T(80, 345, "\u201COur team will get back to you shortly.\u201D", 30, G400, font=SERIF, style="font-style:italic"))
b.append(f'<line x1="60" y1="130" x2="600" y2="130" stroke="#DC2626" stroke-width="8" opacity="0.85"/>')
b.append(f'<line x1="60" y1="275" x2="470" y2="275" stroke="#DC2626" stroke-width="6" opacity="0.85"/>')
b.append(f'<g transform="rotate(-12 590 185)">'
         f'<rect x="420" y="128" width="340" height="112" fill="none" stroke="{VIOLETD}" stroke-width="8" rx="12"/>'
         + T(590, 203, "NEVER REPLIED", 43, VIOLETD, weight="900", anchor="middle", spacing="1")
         + '</g>')
b.append(f'<rect x="0" y="{H-130}" width="{W}" height="130" fill="{BLACK}"/>')
b.append(logo_img(70, H-112, 90))
b.append(T(180, H-70, "We find you the one who replies.", 29, WHITE, weight="bold"))
b.append(T(180, H-30, "candidai.tech", 30, VIOLETL, weight="bold", spacing="2"))
qs2 = 100
b.append(qr_group(W-60-qs2, H-115, qs2, BLACK, bg=WHITE))
svg("card-qr-front", 85, 55, "".join(b))

# BACK: the funeral invite
b = [f'<rect width="{W}" height="{H}" rx="24" fill="{BLACK}"/>']
b.append(T(70, 145, "YOUR CV DIED", 70, WHITE, weight="900"))
b.append(T(70, 230, "IN AN ATS.", 70, WHITE, weight="900"))
b.append(T(70, 335, "THIS CARD IS ITS", 58, FUCHSIA, weight="900"))
b.append(T(70, 402, "FUNERAL INVITE.", 58, FUCHSIA, weight="900"))
qs2 = 155
b.append(qr_group(W-70-qs2, 85, qs2, WHITE))
b.append(f'<line x1="70" y1="445" x2="{W-70}" y2="445" stroke="{G500}" stroke-width="2"/>')
b.append(logo_img(70, 462, 62))
b.append(T(150, 502, "ambassador code: ________", 30, G500, font=MONO))
b.append(T(W-70, 502, "candidai.tech", 32, VIOLETL, weight="bold", anchor="end"))
svg("card-qr-back", 85, 55, "".join(b))

# =========================================================
# 3. FLYER WITH TEAR-OFF TABS — A4 (210 x 297 mm)
# =========================================================
W, H = 2100, 2970
b = [f'<rect width="{W}" height="{H}" fill="{WHITE}"/>',
     # photocopy frame
     f'<rect x="60" y="60" width="{W-120}" height="{H-120}" fill="none" stroke="{BLACK}" stroke-width="8"/>',
     f'<rect x="84" y="84" width="{W-168}" height="{H-168}" fill="none" stroke="{BLACK}" stroke-width="3"/>']
b.append(T(W/2, 330, "WANTED", 300, BLACK, font=MONO, weight="900", anchor="middle", spacing="30"))
b.append(T(W/2, 480, "JUNIOR DEVELOPER", 120, BLACK, font=MONO, weight="900", anchor="middle", spacing="10"))
b.append(f'<line x1="200" y1="560" x2="{W-200}" y2="560" stroke="{BLACK}" stroke-width="6"/>')
req = [
    "REQUIREMENTS:",
    "",
    "- 5 YEARS OF EXPERIENCE",
    "  (FOR AN ENTRY-LEVEL ROLE)",
    "- INTERNSHIP SALARY",
    "- 2,000 CANDIDATES ALREADY IN LINE",
    "- INFINITE PATIENCE",
    "",
    "WE WILL NOT REPLY TO YOUR APPLICATION.",
    "NOBODY DOES.",
]
y = 720
for ln in req:
    if ln:
        b.append(T(240, y, ln, 66, BLACK, font=MONO, weight="bold"))
    y += 92
b.append(T(W/2, y+80, "OR JUST TEAR OFF A TAB.", 96, BLACK, font=MONO, weight="900", anchor="middle"))
b.append(T(W/2, y+190, "Direct, personalized emails to the right recruiters.", 50, BLACK, font=MONO, anchor="middle"))
b.append(T(W/2, y+260, "Powered by AI.", 50, BLACK, font=MONO, anchor="middle"))
b.append(T(W/2, y+360, "candidai.tech", 64, BLACK, font=MONO, weight="900", anchor="middle", spacing="6"))
# tear-off tabs: 8 tabs at bottom
tabs_top = H - 620
b.append(f'<line x1="60" y1="{tabs_top}" x2="{W-60}" y2="{tabs_top}" stroke="{BLACK}" stroke-width="4" stroke-dasharray="22 16"/>')
ntabs = 8
tw = (W-120)/ntabs
for i in range(ntabs):
    x0 = 60 + i*tw
    if i > 0:
        b.append(f'<line x1="{x0}" y1="{tabs_top}" x2="{x0}" y2="{H-60}" stroke="{BLACK}" stroke-width="3" stroke-dasharray="16 14"/>')
    qs = 130
    b.append(qr_group(x0+(tw-qs)/2, tabs_top+35, qs, BLACK))
    # rotated URL text
    cx, cy = x0+tw/2, tabs_top+390
    b.append(f'<text x="{cx}" y="{cy}" font-family="{MONO}" font-size="38" fill="{BLACK}" '
             f'font-weight="bold" text-anchor="middle" transform="rotate(90 {cx} {cy})" '
             f'letter-spacing="1">candidai.tech</text>')
svg("flyer-tear-tabs", 210, 297, "".join(b))

# =========================================================
# 4. REJECTION LETTERS — A4
# =========================================================
def letter(name, company, body_lines, accent=False, closing="Talent Acquisition Team"):
    W, H = 2100, 2970
    b = [f'<rect width="{W}" height="{H}" fill="{WHITE}"/>']
    if accent:
        b.append(f'<rect x="0" y="0" width="{W}" height="26" fill="{VIOLET}"/>')
    # letterhead
    hcol = VIOLETD if accent else BLACK
    if accent:
        b.append(logo_img(260, 210, 120))
        b.append(T(410, 300, company, 76, hcol, font=SERIF, weight="bold", spacing="2"))
    else:
        b.append(T(260, 300, company, 76, hcol, font=SERIF, weight="bold", spacing="2"))
    sub = "The email that actually gets read" if accent else "Human Resources Department"
    b.append(T(410 if accent else 260, 370, sub, 44, G500, font=SERIF, style="font-style:italic"))
    b.append(f'<line x1="260" y1="430" x2="{W-260}" y2="430" stroke="{G500 if not accent else VIOLET}" stroke-width="3"/>')
    b.append(T(260, 560, "Dear Candidate,", 54, BLACK, font=SERIF))
    y = 680
    for ln in body_lines:
        if ln:
            b.append(T(260, y, ln, 54, BLACK, font=SERIF))
        y += 86
    y += 60
    b.append(T(260, y, "Kind regards,", 54, BLACK, font=SERIF)); y += 140
    b.append(T(260, y, closing, 54, BLACK, font=SERIF, style="font-style:italic"))
    if accent:
        b.append(T(260, H-220, "This is what your inbox looks like when the right recruiter gets the right email.",
                   40, VIOLETD, font=SERIF, style="font-style:italic"))
        b.append(T(260, H-150, "candidai.tech", 44, VIOLETD, font=SERIF, weight="bold"))
        b.append(qr_group(2100-260-170, 2970-560, 170, VIOLETD))
    else:
        b.append(T(260, H-200, f"{company} — This is an automated message. Replies to this address are not monitored.",
                   36, G500, font=SERIF))
    svg(name, 210, 297, "".join(b))

letter("rejection-letter-01", "TALENTCORP GLOBAL", [
    "Thank you for your interest in the position and for the time you invested",
    "in your application.",
    "",
    "After careful consideration, we regret to inform you that we have decided",
    "to move forward with other candidates whose profiles more closely match",
    "our current needs.",
    "",
    "Please note that due to the high volume of applications received, we are",
    "unable to provide individual feedback.",
    "",
    "We encourage you to apply again in the future and wish you every success",
    "in your job search.",
])
letter("rejection-letter-02", "MERIDIAN CONSULTING GROUP", [
    "We appreciate the opportunity to review your application for the Analyst",
    "position within our organization.",
    "",
    "Following a thorough evaluation process, we will not be progressing your",
    "candidacy at this time. This decision reflects the exceptionally competitive",
    "nature of this year's applicant pool of over 2,000 candidates.",
    "",
    "Your details will be kept on file for a period of twelve months, in",
    "accordance with our data retention policy.",
    "",
    "We wish you the very best in your future endeavours.",
])
letter("rejection-letter-03", "NORTHBRIDGE TECHNOLOGIES", [
    "Thank you for applying to the Junior Software Engineer opening.",
    "",
    "Unfortunately, your profile was not selected to move to the next stage of",
    "the recruitment process. Our screening system reviewed your application",
    "together with several thousand others for this role.",
    "",
    "No further action is required on your part.",
    "",
    "We invite you to monitor our careers page for future opportunities that",
    "may better align with your experience.",
])
# The special one
letter("letter-special", "CANDIDAI", [
    "Thank you for your email.",
    "",
    "It stood out.",
    "",
    "When are you available for an interview?",
], accent=True, closing="A recruiter who actually replied")

# =========================================================
# 5. POST-IT — 76 x 76 mm
# =========================================================
W = H = 760
b = [f'<rect width="{W}" height="{H}" fill="{POSTIT}"/>',
     f'<rect x="0" y="0" width="{W}" height="70" fill="#FCD34D" opacity="0.5"/>']
msg = [
    "If you're reading this,",
    "you're preparing for",
    "interviews that will never",
    "come from LinkedIn.",
]
y = 220
for ln in msg:
    b.append(T(70, y, ln, 56, "#1F2937", font=SCRIPT, style="font-style:italic"))
    y += 92
b.append(T(70, y+50, "candidai.tech  \u2192", 52, "#1F2937", font=SCRIPT, weight="bold"))
b.append(qr_group(W-230, H-230, 150, "#1F2937"))
svg("post-it", 76, 76, "".join(b))

# post-it variant 2
b = [f'<rect width="{W}" height="{H}" fill="{POSTIT}"/>',
     f'<rect x="0" y="0" width="{W}" height="70" fill="#FCD34D" opacity="0.5"/>']
msg = ["This book won't get you", "the interview.", "An email to the right", "recruiter will."]
y = 220
for ln in msg:
    b.append(T(70, y, ln, 56, "#1F2937", font=SCRIPT, style="font-style:italic"))
    y += 92
b.append(T(70, y+50, "candidai.tech  \u2192", 52, "#1F2937", font=SCRIPT, weight="bold"))
b.append(qr_group(W-230, H-230, 150, "#1F2937"))
svg("post-it-02", 76, 76, "".join(b))

# =========================================================
# 6. DIPLOMA — A4 landscape (297 x 210 mm)
# =========================================================
W, H = 2970, 2100
b = [f'<rect width="{W}" height="{H}" fill="{IVORY}"/>']
# ornamental double border
b.append(f'<rect x="80" y="80" width="{W-160}" height="{H-160}" fill="none" stroke="{VIOLETD}" stroke-width="10"/>')
b.append(f'<rect x="120" y="120" width="{W-240}" height="{H-240}" fill="none" stroke="{VIOLETD}" stroke-width="3"/>')
# corner flourishes
for cx, cy in [(120,120),(W-120,120),(120,H-120),(W-120,H-120)]:
    b.append(f'<circle cx="{cx}" cy="{cy}" r="34" fill="none" stroke="{VIOLETD}" stroke-width="6"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="14" fill="{VIOLETD}"/>')
b.append(T(W/2, 360, "The International Institute of Modern Job Hunting", 60, "#4B5563", font=SERIF, anchor="middle", style="font-style:italic"))
b.append(T(W/2, 470, "hereby confers upon the bearer the degree of", 54, "#4B5563", font=SERIF, anchor="middle"))
b.append(T(W/2, 680, "MASTER'S DEGREE", 170, BLACK, font=SERIF, weight="bold", anchor="middle", spacing="6"))
b.append(T(W/2, 880, "in IGNORED APPLICATIONS", 130, VIOLETD, font=SERIF, weight="bold", anchor="middle"))
b.append(f'<line x1="700" y1="960" x2="{W-700}" y2="960" stroke="{BLACK}" stroke-width="3"/>')
b.append(T(W/2, 1080, "conferred upon you and 2,000 other candidates", 62, BLACK, font=SERIF, anchor="middle", style="font-style:italic"))
b.append(T(W/2, 1170, "for the same position", 62, BLACK, font=SERIF, anchor="middle", style="font-style:italic"))
b.append(T(W/2, 1330, "with honors in: unanswered follow-ups, ATS ghosting, and motivational cover letters nobody read", 44, "#6B7280", font=SERIF, anchor="middle"))
# seal + signatures
b.append(f'<circle cx="620" cy="1680" r="150" fill="{VIOLETD}"/>')
b.append(f'<circle cx="620" cy="1680" r="120" fill="none" stroke="{IVORY}" stroke-width="4"/>')
b.append(T(620, 1630, "OFFICIAL", 34, IVORY, font=SERIF, anchor="middle", weight="bold"))
b.append(T(620, 1680, "SEAL OF", 30, IVORY, font=SERIF, anchor="middle"))
b.append(T(620, 1725, "SILENCE", 30, IVORY, font=SERIF, anchor="middle"))
b.append(f'<line x1="1150" y1="1720" x2="1750" y2="1720" stroke="{BLACK}" stroke-width="3"/>')
b.append(T(1450, 1780, "Dean of Rejections", 44, "#4B5563", font=SERIF, anchor="middle", style="font-style:italic"))
b.append(f'<line x1="2000" y1="1720" x2="2600" y2="1720" stroke="{BLACK}" stroke-width="3"/>')
b.append(T(2300, 1780, "Head of Automated Replies", 44, "#4B5563", font=SERIF, anchor="middle", style="font-style:italic"))
# escape route
b.append(logo_img(W/2 - 560, 1885, 85))
b.append(T(W/2 + 50, 1950, "There is a way out.  \u2014  candidai.tech", 56, VIOLETD, font=SERIF, weight="bold", anchor="middle"))
qs = 160
b.append(qr_group(2660, 1560, qs, VIOLETD))
svg("diploma", 297, 210, "".join(b))

# =========================================================
# 7. INSTRUCTION SHEET — A4, dark
# =========================================================
W, H = 2100, 2970
b = [f'<rect width="{W}" height="{H}" fill="{DARK}"/>']
b.append(logo_img(2100-160-200, 170, 200))
b.append(T(160, 280, "AMBASSADOR KIT", 130, WHITE, weight="900", spacing="2"))
b.append(T(160, 400, "Field manual \u2014 read once, then go make noise.", 52, VTEXT))
b.append(f'<rect x="160" y="460" width="300" height="10" fill="{VIOLET}"/>')

def section(bl, y, title, lines, font_size=44, line_height=66, bottom_gap=38):
    bl.append(T(160, y, title.upper(), 58, VIOLET, weight="900", spacing="3"))
    yy = y + 90
    for ln in lines:
        bl.append(T(160, yy, ln, font_size, G300))
        yy += line_height
    return yy + bottom_gap

y = 620
y = section(b, y, "1 \u2014 Your QR is your score", [
    "Every sticker, card and tab in this kit carries YOUR tracked link.",
    "Scans, signups and qualifying purchases appear in your dashboard in real time.",
    "Only completed qualifying purchases earn commissions and milestone rewards.",
])
y = section(b, y, "2 \u2014 The actions", [
    "\u25AA Stickers \u2192 boards, study rooms, free spaces. Test all 5 designs.",
    "\u25AA Tear-off flyer \u2192 approved or free-posting notice boards only.",
    "\u25AA Rejection wall \u2192 one board, 20+ letters, 1 special letter in the middle.",
    "\u25AA Post-its \u2192 interview-prep books, only where explicitly permitted.",
    "\u25AA Diplomas \u2192 graduation days, hand them out with a straight face.",
    "\u25AA Career fair \u2192 A3 sign + cards in permitted areas; never block access.",
    "\u25AA CV funeral \u2192 coordinate the venue and props; get approval first.",
], font_size=42, line_height=61, bottom_gap=34)
y = section(b, y, "3 \u2014 Where yes / where no", [
    "YES: student notice boards, free-posting areas, your own laptop, handing out.",
    "NO: monuments, private property, restricted areas, or anywhere marked 'no bills'.",
    "Use the removable tape provided. Leave no damage. Irony yes, insults no.",
])
y = section(b, y, "4 \u2014 The pitch (15 seconds)", [
    "\u201CLinkedIn applications get ignored \u2014 thousands of CVs per role.",
    "CandidAI finds the right recruiter at your target company and writes",
    "a personalized email to them \u2014 a more direct way to start a conversation.\u201D",
])
y = section(b, y, "5 \u2014 Commissions + rewards", [
    "Progressive rates: 1\u20135: 5%   \u2022   6\u201315: 10%   \u2022   16\u201330: 15%   \u2022   31+: 20%",
    "15 in 1 month \u2192 campaign T-shirt.",
    "50 in 3 months \u2192 rare stickers + pin + merch choice + 25,000 credits.",
    "200 in 1 year \u2192 hoodie + Ultra plan + founder CV/LinkedIn review.",
    "Top 3 / semester \u2192 reference + badge + 20% commission boost + insider access.",
], font_size=40, line_height=58, bottom_gap=20)
b.append(T(160, 2580, "Benefits, thresholds and fulfilment are subject to current program terms.", 34, G500))
b.append(f'<line x1="160" y1="{H-260}" x2="{W-160}" y2="{H-260}" stroke="{G500}" stroke-width="2"/>')
b.append(T(160, H-170, "Questions? \u2192 Use the ambassador support channel shared after approval.", 40, G400))
b.append(T(W-160, H-170, "candidai.tech", 52, VIOLET, weight="900", anchor="end"))
svg("instruction-sheet", 210, 297, "".join(b))

print("\nAll files in", OUT)
