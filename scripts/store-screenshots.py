"""
Monta las capturas del App Store (iPhone 6,5", 1284 x 2778) a partir de las
capturas en crudo del simulador: fondo terracota de la marca, titular y
subtítulo en cada idioma y la captura dentro de un marco de iPhone.

Las capturas en crudo (1179 x 2556, iPhone 16) van en
store/screenshots/raw/<idioma>/<n>-<pantalla>.png y no se suben al repo;
se sacan con la app en modo demo (npm run demo:emulators, demo:seed y
demo:app) cambiando el idioma en Perfil > ajustes > Idioma.

Uso:  python3 scripts/store-screenshots.py      (necesita Pillow)
Sale: store/screenshots/<idioma>/<n>-<pantalla>.jpg, que store.config.json
      sube con `npx eas-cli metadata:push`.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
CRUDAS = RAIZ / 'store' / 'screenshots' / 'raw'
SALIDA = RAIZ / 'store' / 'screenshots'
FUENTES = RAIZ / 'node_modules' / '@expo-google-fonts'
TITULAR = FUENTES / 'baloo-2' / '800ExtraBold' / 'Baloo2_800ExtraBold.ttf'
SUBTITULO = FUENTES / 'work-sans' / '500Medium' / 'WorkSans_500Medium.ttf'

ANCHO, ALTO = 1284, 2778
# Los mismos tonos que el degradado del icono (LogoMark).
DEGRADADO = [(0.0, (245, 154, 98)), (0.55, (221, 107, 62)), (1.0, (184, 68, 31))]
MARCO = (31, 23, 20)

# Pantalla dentro del marco: igual en todas, para que la serie quede alineada.
PANTALLA_ANCHO = 940
BISEL = 22
RADIO_PANTALLA = 118
MARGEN_ABAJO = 80

TEXTOS = {
    'en': [
        ('1-muro', 'Help is right next door', 'Favors or paid help, from your neighbors.'),
        ('2-detalle', 'Lend a hand, earn a fair price', 'Offer your help and get the full price.'),
        ('3-ofertas', 'Pick who helps you', 'Paid upfront, held safely until it’s done.'),
        ('4-resenas', 'Trust built by neighbors', 'Every help ends with an honest review.'),
        ('5-mapa', 'Find requests near you', 'Everything on the map, minutes away.'),
        ('6-chat', 'Agree on the details', 'Chat privately with the neighbor who helps.'),
    ],
    'de': [
        ('1-muro', 'Hilfe gleich nebenan', 'Gefallen oder bezahlte Hilfe von Nachbarn.'),
        ('2-detalle', 'Helfen zum fairen Preis', 'Biete Hilfe an und erhalte den vollen Preis.'),
        ('3-ofertas', 'Wähle, wer dir hilft', 'Vorab bezahlt, sicher bis zur Erledigung.'),
        ('4-resenas', 'Vertrauen unter Nachbarn', 'Jede Hilfe endet mit einer ehrlichen Bewertung.'),
        ('5-mapa', 'Anfragen in deiner Nähe', 'Alles auf der Karte, nur Minuten entfernt.'),
        ('6-chat', 'Details direkt absprechen', 'Schreib privat mit der Person, die dir hilft.'),
    ],
    'es': [
        ('1-muro', 'La ayuda, en tu barrio', 'Favores o ayuda pagada, entre vecinos.'),
        ('2-detalle', 'Ayuda a un precio justo', 'Ofrece tu ayuda y cobra el precio entero.'),
        ('3-ofertas', 'Elige quién te ayuda', 'Pagado al publicar, guardado hasta que esté hecho.'),
        ('4-resenas', 'Confianza entre vecinos', 'Cada ayuda termina con una valoración sincera.'),
        ('5-mapa', 'Encuentra ayuda cerca', 'Todo en el mapa, a pocos minutos.'),
        ('6-chat', 'Acuerda los detalles', 'Chatea en privado con quien te ayuda.'),
    ],
}


def fondo():
    """Degradado en diagonal, de arriba a la izquierda hacia abajo a la derecha."""
    # Se pinta en pequeño y se escala: suave y mucho más rápido que píxel a píxel.
    pequeno = Image.new('RGB', (64, 138))
    for y in range(pequeno.height):
        for x in range(pequeno.width):
            t = min(1.0, (x / pequeno.width) * 0.35 + (y / pequeno.height) * 0.65)
            for (t0, c0), (t1, c1) in zip(DEGRADADO, DEGRADADO[1:]):
                if t <= t1:
                    k = (t - t0) / (t1 - t0)
                    pequeno.putpixel((x, y), tuple(round(a + (b - a) * k) for a, b in zip(c0, c1)))
                    break
    return pequeno.resize((ANCHO, ALTO), Image.BICUBIC)


def partir(texto, fuente, ancho_max, dibujo):
    """
    Una línea si cabe; si no, dos de ancho parecido (sin palabras sueltas
    al final). None si ni así cabe.
    """
    if dibujo.textlength(texto, font=fuente) <= ancho_max:
        return [texto]
    palabras = texto.split()
    mejor = None
    for i in range(1, len(palabras)):
        lineas = [' '.join(palabras[:i]), ' '.join(palabras[i:])]
        ancho = max(dibujo.textlength(l, font=fuente) for l in lineas)
        if ancho <= ancho_max and (mejor is None or ancho < mejor[0]):
            mejor = (ancho, lineas)
    return mejor[1] if mejor else None


def texto_centrado(dibujo, lineas, fuente, y, alto_linea, color):
    for linea in lineas:
        ancho = dibujo.textlength(linea, font=fuente)
        dibujo.text(((ANCHO - ancho) / 2, y), linea, font=fuente, fill=color)
        y += alto_linea
    return y


def componer(captura, titular, subtitulo):
    lienzo = fondo().convert('RGBA')
    dibujo = ImageDraw.Draw(lienzo)

    pantalla_alto = round(PANTALLA_ANCHO * captura.height / captura.width)
    marco_ancho, marco_alto = PANTALLA_ANCHO + 2 * BISEL, pantalla_alto + 2 * BISEL
    marco_x, marco_y = (ANCHO - marco_ancho) // 2, ALTO - MARGEN_ABAJO - marco_alto

    # Textos en una o dos líneas; si no caben, encogen.
    ancho_texto = ANCHO - 2 * 100
    for tamano in range(108, 70, -4):
        f_titular = ImageFont.truetype(str(TITULAR), tamano)
        lineas_titular = partir(titular, f_titular, ancho_texto, dibujo)
        if lineas_titular:
            break
    for tamano_sub in range(50, 36, -2):
        f_sub = ImageFont.truetype(str(SUBTITULO), tamano_sub)
        lineas_sub = partir(subtitulo, f_sub, ancho_texto, dibujo)
        if lineas_sub:
            break
    alto_titular, alto_sub, hueco = round(tamano * 1.08), round(tamano_sub * 1.32), 44
    alto_bloque = len(lineas_titular) * alto_titular + hueco + len(lineas_sub) * alto_sub
    y = max(110, (marco_y - 40 - alto_bloque) // 2 + 10)
    y = texto_centrado(dibujo, lineas_titular, f_titular, y, alto_titular, (255, 255, 255))
    texto_centrado(dibujo, lineas_sub, f_sub, y + hueco, alto_sub, (255, 240, 230))

    # Sombra suave bajo el teléfono.
    sombra = Image.new('L', (ANCHO, ALTO), 0)
    ImageDraw.Draw(sombra).rounded_rectangle(
        (marco_x + 10, marco_y + 34, marco_x + marco_ancho - 10, marco_y + marco_alto + 30),
        radius=RADIO_PANTALLA + BISEL, fill=110,
    )
    sombra = sombra.filter(ImageFilter.GaussianBlur(36))
    lienzo.paste(Image.new('RGBA', (ANCHO, ALTO), (90, 30, 10, 255)), (0, 0), sombra)

    # Marco y pantalla con las esquinas redondeadas.
    ImageDraw.Draw(lienzo).rounded_rectangle(
        (marco_x, marco_y, marco_x + marco_ancho, marco_y + marco_alto), radius=RADIO_PANTALLA + BISEL, fill=MARCO
    )
    pantalla = captura.convert('RGB').resize((PANTALLA_ANCHO, pantalla_alto), Image.LANCZOS)
    mascara = Image.new('L', pantalla.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, *pantalla.size), radius=RADIO_PANTALLA, fill=255)
    lienzo.paste(pantalla, (marco_x + BISEL, marco_y + BISEL), mascara)
    return lienzo.convert('RGB')


def main():
    hechas = 0
    for idioma, pantallas in TEXTOS.items():
        (SALIDA / idioma).mkdir(parents=True, exist_ok=True)
        for nombre, titular, subtitulo in pantallas:
            cruda = CRUDAS / idioma / f'{nombre}.png'
            if not cruda.exists():
                raise SystemExit(f'Falta la captura {cruda.relative_to(RAIZ)}')
            imagen = componer(Image.open(cruda), titular, subtitulo)
            assert imagen.size == (ANCHO, ALTO)
            imagen.save(SALIDA / idioma / f'{nombre}.jpg', quality=90, optimize=True, progressive=True)
            hechas += 1
    print(f'📸 {hechas} capturas en {SALIDA.relative_to(RAIZ)}/<idioma>/')


if __name__ == '__main__':
    main()
