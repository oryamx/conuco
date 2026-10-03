"""Frases SINTÉTICAS de entrenamiento: cómo podría describir un caficultor cada problema.
Escritas para el hackathon; deben reemplazarse/ampliarse con reportes reales confirmados por técnicos."""

SINTOMAS = {
    "roya": [
        "las hojas tienen un polvillo naranja por debajo", "las hojas están como oxidadas", "se le ve como óxido a las hojas",
        "tiene unas manchas amarillas por detrás de la hoja", "por debajo de la hoja sale un polvito anaranjado",
        "las hojas se están cayendo y quedan las ramas peladas", "la mata se está deshojando", "se le cae toda la hoja",
        "las hojas tienen como herrumbre", "manchas color naranja en la parte de abajo de la hoja",
        "le salió como un moho amarillo debajo de las hojas", "las hojas se ponen amarillas con polvo naranja y se caen",
        "quedaron las matas sin hojas", "al pasar la mano por la hoja queda polvo amarillo",
    ],
    "broca": [
        "los granos tienen un huequito", "el grano sale picado", "encontré un gusanito dentro de la cereza",
        "las cerezas tienen un agujerito en la punta", "hay un bichito negro metido en el grano",
        "los granos se caen antes de tiempo y están picados", "al abrir la pepa está vacía por dentro",
        "el café salió vano y con huecos", "un insecto chiquito le hace huecos al fruto",
        "las pepas tienen un puntico negro con hueco", "en el beneficio salió mucho grano dañado y picado",
        "el grano tiene como polvillo por dentro y un hueco",
    ],
    "minador": [
        "las hojas se ven como quemadas", "manchas marrones secas en las hojas", "la hoja queda como papel",
        "tiene unos caminitos por dentro de la hoja", "las hojas tienen manchas secas que se agrandan",
        "parece que el sol le quemó las hojas", "la hoja se pone café y se seca por partes",
        "unas manchas de color marrón que se despegan como una telita", "las hojas de arriba tienen parches secos",
        "la hoja tiene como ampollas secas", "un gusanito se come la hoja por dentro",
    ],
    "ojo_de_gallo": [
        "manchitas redondas claras en las hojas", "tiene como ojitos en la hoja", "círculos grises en las hojas",
        "manchas redondas como de vela en la parte con mucha sombra", "en la parte húmeda las hojas tienen redondelitos",
        "las hojas tienen puntos redondos blanquecinos", "manchas redonditas que después se caen y dejan hueco",
        "en el bajo donde hay neblina las hojas tienen círculos",
    ],
    "mancha_hierro": [
        "manchas con el centro blanco y el borde rojizo", "las hojas tienen manchas como ojo con borde morado",
        "los granos tienen manchas negras hundidas", "la cereza se pone negra de un lado",
        "manchas cafés con un anillo amarillo alrededor", "las pepas se manchan y se secan antes de madurar",
        "manchas con centro gris en la hoja y también en el grano",
    ],
    "muerte_descendente": [
        "las ramas se secan desde la punta", "se está secando de arriba para abajo", "los palos se están poniendo secos",
        "la punta de las ramas se pone negra y se muere", "las bandolas se secan desde afuera para adentro",
        "los cogollos se están secando", "las ramas nuevas se mueren", "se secan las puntas y se caen las hojas de la punta",
    ],
    "nutricion": [
        "las hojas están amarillas parejas", "las matas están flacas y no crecen", "este año no cargó nada",
        "la cosecha bajó mucho", "las hojas están pálidas", "las matas se ven débiles y descoloridas",
        "las hojas nuevas salen chiquitas y amarillas", "las matas viejas ya no dan", "la mata está raquítica",
        "las hojas tienen las venas verdes y lo demás amarillo", "dio muy poquito café este año",
        "las matas no florecieron bien",
    ],
    "otro": [
        "no sé qué le pasa a la mata", "la mata está fea", "algo le pasa al café", "las matas están raras",
        "quiero que venga el técnico", "no sé explicar lo que tiene", "está mala la siembra",
        "hay un problema en el cafetal", "las matas no se ven bien", "oiga necesito ayuda con el café",
        "buenas tardes es para reportar algo", "no estoy seguro de lo que es",
    ],
}

SUJETOS = ["", "las matas de café", "el cafetal", "mis matas", "las matas de arriba", "las matas del bajo",
           "el café", "las plantas", "las matas nuevas", "el lote de abajo"]
INICIOS = ["", "mire", "oiga", "fíjese que", "buenas,", "le cuento que", "compa", "ay"]
CONTEXTOS = ["", "desde que llovió tanto", "hace como dos semanas", "desde hace un mes", "en casi todas las matas",
             "en unas pocas matas", "con este verano tan fuerte", "desde la semana pasada", "y me preocupa",
             "y los vecinos dicen que también"]

# Frases de prueba escritas aparte, con palabras distintas (no se usan para entrenar).
PRUEBA = [
    ("la hoja tiene como un polvo amarillito por detrás y se están quedando peladas las ramas", "roya"),
    ("se me está oxidando el cafetal", "roya"),
    ("todas las hojas se cayeron después del aguacero y tenían manchas anaranjadas", "roya"),
    ("en la cosecha salieron muchas pepas con un huequito", "broca"),
    ("abrí los granos y tenían un animalito adentro", "broca"),
    ("las cerezas están perforadas", "broca"),
    ("las hojas parecen tostadas", "minador"),
    ("tienen unas manchas secas color café que parecen quemaduras", "minador"),
    ("las hojas tienen unos redondelitos grises donde hay mucha sombra", "ojo_de_gallo"),
    ("aparecieron como ojitos claros en las hojas del bajo", "ojo_de_gallo"),
    ("los granos tienen manchas oscuras y se secan", "mancha_hierro"),
    ("manchas con el centro clarito y orilla morada", "mancha_hierro"),
    ("las ramas se están muriendo de la punta para atrás", "muerte_descendente"),
    ("se secaron los cogollos y las puntas", "muerte_descendente"),
    ("este año las matas casi no dieron", "nutricion"),
    ("las matas están amarillentas y chiquitas", "nutricion"),
    ("la hoja está pálida en todo el lote", "nutricion"),
    ("no sé, la mata está como mala", "otro"),
    ("buenas, quería avisar de un problema", "otro"),
    ("algo raro tienen las matas", "otro"),
]
