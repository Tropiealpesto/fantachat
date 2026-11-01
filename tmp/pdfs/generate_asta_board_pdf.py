from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader


OUT = Path("output/pdf/FantaChat-proposta-asta-board.pdf")
LOGO = Path("public/icons/fantachat-mark.png")
W, H = 1280, 720

BG = HexColor("#061A12")
BG_ALT = HexColor("#0A2419")
PANEL = HexColor("#0D3021")
PANEL_2 = HexColor("#123B29")
GREEN = HexColor("#4ADE80")
GREEN_DARK = HexColor("#1C8F4D")
ORANGE = HexColor("#FF8A26")
CREAM = HexColor("#F7F5EF")
MUTED = HexColor("#A9B9AF")
MUTED_2 = HexColor("#71907D")
INK = HexColor("#0A2116")
LINE = HexColor("#28563D")
WHITE = colors.white


def font_path(name):
    return Path("C:/Windows/Fonts") / name


pdfmetrics.registerFont(TTFont("Segoe", str(font_path("segoeui.ttf"))))
pdfmetrics.registerFont(TTFont("SegoeSemi", str(font_path("seguisb.ttf"))))
pdfmetrics.registerFont(TTFont("SegoeBold", str(font_path("segoeuib.ttf"))))


def pstyle(name, size, color, leading=None, font="Segoe", align=TA_LEFT):
    return ParagraphStyle(
        name=name,
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.2,
        textColor=color,
        alignment=align,
        spaceAfter=0,
    )


def para(c, text, x, y_top, width, style, height=None):
    p = Paragraph(text, style)
    _, h = p.wrap(width, height or H)
    p.drawOn(c, x, y_top - h)
    return h


def rounded(c, x, y, w, h, fill=PANEL, stroke=None, r=16, sw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1 if stroke else 0)


def line(c, x1, y1, x2, y2, color=LINE, sw=1):
    c.setStrokeColor(color)
    c.setLineWidth(sw)
    c.line(x1, y1, x2, y2)


def circle(c, x, y, r, fill, stroke=None, sw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(sw)
    c.circle(x, y, r, fill=1, stroke=1 if stroke else 0)


def top_brand(c, section=None, page=None):
    if LOGO.exists():
        c.drawImage(ImageReader(str(LOGO)), 54, H - 70, width=34, height=34, preserveAspectRatio=True, mask="auto")
    c.setFillColor(CREAM)
    c.setFont("SegoeSemi", 18)
    c.drawString(96, H - 56, "Fanta")
    c.setFillColor(ORANGE)
    c.drawString(148, H - 56, "Chat")
    if section:
        c.setFillColor(MUTED_2)
        c.setFont("Segoe", 11)
        c.drawRightString(W - 54, H - 55, section.upper())
    line(c, 54, H - 86, W - 54, H - 86, LINE, 1)
    if page:
        c.setFillColor(MUTED_2)
        c.setFont("Segoe", 10)
        c.drawRightString(W - 54, 30, f"FantaChat  |  Proposta prodotto  |  {page:02d}")


def title(c, kicker, heading, sub=None, x=72, y=H - 132, width=710):
    c.setFillColor(ORANGE)
    c.setFont("SegoeSemi", 13)
    c.drawString(x, y, kicker.upper())
    heading_style = pstyle("title", 37, CREAM, 42, "SegoeBold")
    heading_h = para(c, heading, x, y - 22, width, heading_style)
    if sub:
        para(c, sub, x, y - 22 - heading_h - 16, width, pstyle("sub", 16, MUTED, 23, "Segoe"))


def bullet(c, x, y, label, body, width, accent=GREEN, number=None):
    if number is not None:
        circle(c, x + 12, y - 10, 12, accent)
        c.setFillColor(BG)
        c.setFont("SegoeBold", 12)
        c.drawCentredString(x + 12, y - 14, str(number))
        tx = x + 35
    else:
        circle(c, x + 5, y - 8, 5, accent)
        tx = x + 22
    para(c, f"<b>{label}</b><br/>{body}", tx, y, width - (tx - x), pstyle("bullet", 15, CREAM, 22, "Segoe"))


def footer_note(c, text):
    c.setFillColor(MUTED_2)
    c.setFont("Segoe", 10)
    c.drawString(72, 30, text)


def draw_cover(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Calm, non-decorative brand field on the right.
    c.setFillColor(PANEL)
    c.rect(850, 0, 430, H, fill=1, stroke=0)
    c.setStrokeColor(GREEN_DARK)
    c.setLineWidth(2)
    c.line(850, 0, 850, H)
    if LOGO.exists():
        c.drawImage(ImageReader(str(LOGO)), 932, 266, width=205, height=205, preserveAspectRatio=True, mask="auto")
    top_brand(c, "Product proposal", 1)
    c.setFillColor(ORANGE)
    c.setFont("SegoeSemi", 15)
    c.drawString(72, 548, "LA PROPOSTA")
    para(c, "L'asta,\nnel cuore di FantaChat", 72, 520, 700, pstyle("cover", 54, CREAM, 59, "SegoeBold"))
    para(c, "Un momento offline, una rosa piu viva, una fonte dati unica.", 72, 350, 650, pstyle("coversub", 22, MUTED, 30, "Segoe"))
    # Three clear product principles.
    items = [("OFFLINE", "L'asta resta una serata sociale"), ("IN APP", "Si registrano giocatore e prezzo"), ("ADMIN", "Una sola conferma ufficiale")]
    x = 72
    for i, (lab, body) in enumerate(items):
        rounded(c, x, 112, 220, 100, PANEL, LINE, 12, 1)
        c.setFillColor(GREEN if i != 1 else ORANGE)
        c.setFont("SegoeBold", 12)
        c.drawString(x + 18, 180, lab)
        para(c, body, x + 18, 158, 182, pstyle(f"coveritem{i}", 14, CREAM, 19, "Segoe"))
        x += 240
    footer_note(c, "Proposta per la roadmap FantaChat  |  Documento di lavoro")
    c.showPage()


def draw_why(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Why now", 2)
    title(c, "01  |  Perche ora", "L'asta non e solo un acquisto: e il momento che tiene viva la lega.", "FantaChat puo trasformare la serata piu importante del fantacalcio in un passaggio tracciato, chiaro e utile per tutta la stagione.")
    # left statement
    rounded(c, 72, 116, 462, 235, PANEL_2, None, 18)
    c.setFillColor(ORANGE)
    c.setFont("SegoeBold", 44)
    c.drawString(104, 290, "01")
    para(c, "Ogni asta genera decisioni, rivalita e nuove storie.", 104, 246, 360, pstyle("statement", 27, CREAM, 32, "SegoeBold"))
    para(c, "Oggi quelle informazioni restano spesso sparse tra chat, fogli e memoria dei partecipanti.", 104, 168, 350, pstyle("statement2", 15, MUTED, 22, "Segoe"))
    # right value points
    bullet(c, 610, 335, "Un appuntamento ricorrente", "Le aste di riparazione riattivano la lega durante la stagione, senza richiedere un nuovo prodotto esterno.", 530, GREEN, 1)
    bullet(c, 610, 232, "Una rosa sempre leggibile", "Giocatori, prezzi e movimenti rimangono consultabili nello stesso spazio in cui si seguono punteggi e classifica.", 530, ORANGE, 2)
    bullet(c, 610, 129, "Un admin piu forte", "L'app non sostituisce chi conduce l'asta: lo aiuta a chiudere ogni passaggio con dati coerenti e verificabili.", 530, GREEN, 3)
    c.showPage()


def draw_model(c):
    c.setFillColor(BG_ALT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Operating model", 3)
    title(c, "02  |  Modello operativo", "Asta offline. Registrazione digitale. Una sola versione della rosa.", "L'esperienza rimane libera e sociale; FantaChat entra nel momento giusto, per rendere ufficiali le scelte.")
    steps = [
        ("01", "Apertura", "L'admin apre la finestra di riparazione e blocca il mercato."),
        ("02", "Svincolo", "Ogni squadra svincola obbligatoriamente 2 giocatori."),
        ("03", "Serata d'asta", "La lega svolge l'asta offline, con le sue regole e i suoi tempi."),
        ("04", "Registrazione", "L'admin inserisce in diretta chi ha preso il giocatore e a quale prezzo."),
    ]
    x = 72
    for i, (num, head, body) in enumerate(steps):
        if i < len(steps) - 1:
            line(c, x + 245, 313, x + 276, 313, GREEN_DARK, 2)
        rounded(c, x, 172, 232, 286, PANEL, LINE, 16, 1)
        circle(c, x + 34, 414, 19, ORANGE if i == 2 else GREEN)
        c.setFillColor(BG)
        c.setFont("SegoeBold", 12)
        c.drawCentredString(x + 34, 410, num)
        c.setFillColor(CREAM)
        c.setFont("SegoeBold", 20)
        c.drawString(x + 24, 362, head)
        para(c, body, x + 24, 325, 180, pstyle(f"step{i}", 15, MUTED, 22, "Segoe"))
        x += 284
    rounded(c, 72, 92, 1136, 46, HexColor("#133D29"), None, 10)
    c.setFillColor(GREEN)
    c.setFont("SegoeBold", 13)
    c.drawString(94, 110, "PRINCIPIO GUIDA")
    c.setFillColor(CREAM)
    c.setFont("Segoe", 13)
    c.drawString(245, 110, "FantaChat non digitalizza la discussione: digitalizza il risultato ufficiale.")
    c.showPage()


def roster_card(c, x, y, role, starters, reserves, color):
    rounded(c, x, y, 174, 118, PANEL, LINE, 12, 1)
    c.setFillColor(color)
    c.setFont("SegoeBold", 13)
    c.drawString(x + 16, y + 87, role)
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 28)
    c.drawString(x + 16, y + 48, str(starters))
    c.setFillColor(MUTED)
    c.setFont("Segoe", 13)
    c.drawString(x + 49, y + 52, "titolari")
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 18)
    c.drawString(x + 16, y + 20, f"+ {reserves} riserve")


def draw_rules(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Rules", 4)
    title(c, "03  |  Regole della rosa", "Due svincoli per squadra. Sempre.", "La dimensione della lega non cambia la regola: ogni squadra libera due slot a ogni asta di riparazione.")
    c.setFillColor(MUTED)
    c.setFont("SegoeSemi", 12)
    c.drawString(72, 350, "ESEMPIO DI ROSA CON MODULO 3-4-3")
    cards = [("P", 1, 1, HexColor("#FFD84A")), ("D", 3, 2, GREEN), ("C", 4, 2, HexColor("#55A6FF")), ("A", 3, 2, HexColor("#FF5BBF"))]
    x = 72
    for role, st, res, col in cards:
        roster_card(c, x, 210, role, st, res, col)
        x += 190
    rounded(c, 862, 184, 346, 246, PANEL_2, None, 18)
    c.setFillColor(ORANGE)
    c.setFont("SegoeBold", 48)
    c.drawString(900, 345, "2")
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 20)
    c.drawString(960, 356, "svincoli obbligatori")
    para(c, "La scelta dei giocatori resta nelle mani della squadra. L'asta successiva parte solo quando tutte hanno confermato i propri due svincoli.", 900, 310, 254, pstyle("rulebox", 15, MUTED, 22, "Segoe"))
    # bottom rules
    rules = [
        ("Prezzo nuovo", "Se un giocatore torna alla squadra che lo aveva, riparte da una nuova asta: il vecchio prezzo non vale piu."),
        ("Rosa coerente", "L'app segnala gli slot liberati e impedisce di chiudere una rosa non compatibile con il modulo della lega."),
        ("Crediti residui", "Dopo l'asta, cio che resta rimane alla squadra e diventa parte del budget successivo."),
    ]
    x = 72
    for i, (head, body) in enumerate(rules):
        rounded(c, x, 82, 348, 82, PANEL, LINE, 10, 1)
        c.setFillColor(GREEN if i != 1 else ORANGE)
        c.setFont("SegoeBold", 13)
        c.drawString(x + 18, 137, head)
        para(c, body, x + 18, 120, 305, pstyle(f"r{i}", 12, MUTED, 16, "Segoe"))
        x += 372
    c.showPage()


def draw_credits(c):
    c.setFillColor(BG_ALT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Competitive balance", 5)
    title(c, "04  |  Crediti e competitivita", "Premiare chi insegue, senza cancellare la strategia.", "Il budget della riparazione parte da cio che resta dopo l'asta e aggiunge un correttivo legato alla classifica.")
    # formula area
    rounded(c, 72, 300, 1136, 126, PANEL_2, None, 18)
    c.setFillColor(MUTED)
    c.setFont("SegoeSemi", 12)
    c.drawString(104, 390, "BUDGET DISPONIBILE ALLA RIPARAZIONE")
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 26)
    c.drawString(104, 342, "Crediti residui")
    c.setFillColor(ORANGE)
    c.setFont("SegoeBold", 32)
    c.drawString(410, 340, "+")
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 26)
    c.drawString(468, 342, "Bonus classifica")
    c.setFillColor(GREEN)
    c.setFont("SegoeBold", 32)
    c.drawString(820, 340, "=")
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 26)
    c.drawString(878, 342, "Budget asta")
    # reverse rank mapping
    c.setFillColor(MUTED)
    c.setFont("SegoeSemi", 12)
    c.drawString(72, 258, "MECCANISMO DI RIEQUILIBRIO")
    rows = [("1° in classifica", "riceve il punteggio di riferimento dell'ultimo"), ("2° in classifica", "riceve il punteggio di riferimento del penultimo"), ("...", "la logica continua in modo speculare"), ("ultimo in classifica", "riceve il punteggio di riferimento del primo")]
    y = 224
    for i, (left, right) in enumerate(rows):
        rounded(c, 72, y - 15, 1136, 38, PANEL if i % 2 == 0 else BG_ALT, None, 6)
        c.setFillColor(ORANGE if i in (0, 3) else GREEN)
        c.setFont("SegoeBold", 14)
        c.drawString(94, y, left)
        c.setFillColor(MUTED)
        c.setFont("Segoe", 14)
        c.drawString(340, y, right)
        y -= 42
    rounded(c, 72, 52, 1136, 38, HexColor("#2C2515"), HexColor("#765124"), 10, 1)
    c.setFillColor(ORANGE)
    c.setFont("SegoeBold", 12)
    c.drawString(94, 66, "Perche funziona")
    c.setFillColor(CREAM)
    c.setFont("Segoe", 12)
    c.drawString(220, 66, "Il primo conserva il vantaggio della rosa; l'ultimo ottiene margine per rientrare in gioco.")
    c.showPage()


def draw_app(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Product flow", 6)
    title(c, "05  |  Dentro l'app", "Tre azioni semplici per chiudere una serata complessa.", "Il flusso e pensato per l'admin: rapido durante l'asta, verificabile dopo l'asta, leggibile per tutta la lega.")
    # Three app screens
    screens = [
        (72, "01", "Apertura", "Riparazione aperta", ["2 svincoli richiesti", "Budget calcolato", "Asta non ancora chiusa"], GREEN),
        (432, "02", "Inserimento", "Registra acquisto", ["Squadra", "Giocatore", "Prezzo pagato"], ORANGE),
        (792, "03", "Conferma", "Rosa aggiornata", ["Movimento salvato", "Crediti aggiornati", "Storico disponibile"], GREEN),
    ]
    for x, num, head, screen_title, rows, col in screens:
        rounded(c, x, 116, 300, 282, PANEL, LINE, 18, 1)
        c.setFillColor(col)
        c.setFont("SegoeBold", 13)
        c.drawString(x + 22, 364, num)
        c.setFillColor(CREAM)
        c.setFont("SegoeBold", 21)
        c.drawString(x + 60, 362, head)
        line(c, x + 22, 337, x + 278, 337, LINE, 1)
        c.setFillColor(MUTED)
        c.setFont("Segoe", 12)
        c.drawString(x + 22, 309, "FANTACHAT  /  ASTA")
        c.setFillColor(CREAM)
        c.setFont("SegoeSemi", 17)
        c.drawString(x + 22, 274, screen_title)
        yy = 232
        for row in rows:
            circle(c, x + 29, yy + 4, 4, col)
            c.setFillColor(MUTED)
            c.setFont("Segoe", 14)
            c.drawString(x + 45, yy, row)
            yy -= 30
    # workflow strip
    rounded(c, 72, 62, 1020, 32, PANEL_2, None, 8)
    c.setFillColor(GREEN)
    c.setFont("SegoeSemi", 12)
    c.drawString(92, 73, "Admin inserisce")
    c.setFillColor(MUTED)
    c.drawString(230, 73, "->")
    c.setFillColor(ORANGE)
    c.drawString(270, 73, "App valida")
    c.setFillColor(MUTED)
    c.drawString(396, 73, "->")
    c.setFillColor(GREEN)
    c.drawString(438, 73, "Rosa e crediti aggiornati")
    c.setFillColor(MUTED)
    c.drawString(670, 73, "->")
    c.setFillColor(CREAM)
    c.drawString(712, 73, "Storico consultabile")
    c.setFillColor(MUTED_2)
    c.setFont("Segoe", 11)
    c.drawRightString(1208, 73, "Nessun motore di offerte da costruire")
    c.showPage()


def draw_value(c):
    c.setFillColor(BG_ALT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Decision", 7)
    title(c, "06  |  Valore per il prodotto", "Una funzionalita leggera da usare, forte da ricordare.", "L'asta aumenta il valore di FantaChat senza imporre alla lega un modo nuovo di vivere la propria serata.")
    values = [
        ("Engagement", "Riporta gli utenti nell'app anche fuori dalla giornata di campionato.", GREEN),
        ("Retention", "La rosa aggiornata e lo storico rendono FantaChat utile per tutta la stagione.", ORANGE),
        ("Trust", "Un inserimento admin, un prezzo, una fonte ufficiale per tutti.", GREEN),
        ("Semplicita", "Niente live bidding: l'app registra il risultato dell'asta reale.", ORANGE),
    ]
    x = 72
    y = 288
    for i, (head, body, col) in enumerate(values):
        if i == 2:
            x = 72
            y = 142
        rounded(c, x, y, 528, 108, PANEL, LINE, 14, 1)
        c.setFillColor(col)
        c.setFont("SegoeBold", 18)
        c.drawString(x + 24, y + 72, head)
        para(c, body, x + 24, y + 52, 470, pstyle(f"value{i}", 14, MUTED, 20, "Segoe"))
        x += 560
    rounded(c, 1120, 142, 88, 254, PANEL_2, None, 16)
    c.setFillColor(ORANGE)
    c.setFont("SegoeBold", 22)
    c.drawCentredString(1164, 356, "F")
    c.setFillColor(GREEN)
    c.setFont("SegoeBold", 22)
    c.drawCentredString(1164, 316, "C")
    c.setFillColor(CREAM)
    c.setFont("SegoeBold", 13)
    c.drawCentredString(1164, 190, "ASTA")
    c.drawCentredString(1164, 172, "COME")
    c.drawCentredString(1164, 154, "MOMENTO")
    c.showPage()


def draw_close(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, "Next step", 8)
    c.setFillColor(ORANGE)
    c.setFont("SegoeSemi", 14)
    c.drawString(72, 562, "PROPOSTA DI DECISIONE")
    para(c, "Portare l'asta\ndentro FantaChat.", 72, 530, 660, pstyle("closehead", 52, CREAM, 58, "SegoeBold"))
    para(c, "Un MVP focalizzato, coerente con le abitudini delle leghe e pronto a valorizzare ogni asta di riparazione.", 72, 355, 610, pstyle("closesub", 20, MUTED, 28, "Segoe"))
    # two-column next steps
    rounded(c, 72, 64, 512, 220, PANEL_2, None, 16)
    c.setFillColor(GREEN)
    c.setFont("SegoeBold", 14)
    c.drawString(102, 250, "MVP PROPOSTO")
    bullet(c, 102, 228, "Regole", "2 svincoli, budget e rosa coerenti.", 430, GREEN)
    bullet(c, 102, 174, "Admin", "Inserimento live di squadra, giocatore, prezzo.", 430, ORANGE)
    bullet(c, 102, 120, "Storico", "Movimenti, crediti e rosa consultabili.", 430, GREEN)
    rounded(c, 630, 112, 578, 172, PANEL, LINE, 16, 1)
    c.setFillColor(ORANGE)
    c.setFont("SegoeBold", 14)
    c.drawString(660, 250, "DECISIONE RICHIESTA")
    para(c, "Approvare il principio di prodotto:", 660, 222, 500, pstyle("ask1", 17, CREAM, 23, "SegoeSemi"))
    para(c, "l'asta si vive offline, FantaChat la rende ufficiale, ordinata e utile per tutta la stagione.", 660, 182, 500, pstyle("ask2", 16, MUTED, 23, "Segoe"))
    c.setFillColor(GREEN)
    c.setFont("SegoeBold", 16)
    c.drawString(660, 128, "Prossimo passo: definire il regolamento MVP")
    footer_note(c, "FantaChat  |  Documento interno di proposta")
    c.showPage()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("FantaChat - Proposta asta per il board")
    c.setAuthor("FantaChat")
    draw_cover(c)
    draw_why(c)
    draw_model(c)
    draw_rules(c)
    draw_credits(c)
    draw_app(c)
    draw_value(c)
    draw_close(c)
    c.save()
    print(OUT.resolve())


if __name__ == "__main__":
    main()
