// Diccionario campesino → término técnico.
// IMPORTANTE: borrador construido para el hackathon. Debe validarse con
// caficultores y agrónomos de cada zona antes de usarse en campo.
// Cada patrón es una expresión regular sobre texto normalizado (minúsculas, sin acentos).

const SINTOMAS_CAFE = [
  {
    id: 'roya',
    tecnico: 'Síntoma compatible con roya del café (Hemileia vastatrix)',
    sencillo: 'hojas con polvillo naranja o amarillo por debajo, que se caen',
    patrones: [
      /oxid/, /\boxido\b/, /polvill/, /polvito/, /polvo (naranja|amarill|anaranj)/,
      /(naranja|anaranjad|amarillent|amarill)[a-z]* (por|de) (debajo|abajo|atras)/,
      /debajo de la hoja/, /\broya\b/, /se (le )?(estan )?cay(endo|en) las hojas/, /se deshoj/,
      /manchas? (naranja|anaranjad)/, /(oxidad|manchad|amarill)[a-z]* (por|de) (debajo|abajo|atras)/, /se (le )?(estan )?cayendo/,
    ],
  },
  {
    id: 'broca',
    tecnico: 'Síntoma compatible con broca del café (Hypothenemus hampei)',
    sencillo: 'granos con un huequito, picados por un bichito',
    patrones: [
      /hueq?uit/, /\bhueco/, /agujer/, /picad/, /\bbroca\b/, /gusanit/, /bichit/,
      /(grano|cereza|pepa)s? (vaci|vano|negr|dañad)/, /(grano|cereza|pepa)s? .{0,20}(hueco|huequito|agujero)/,
    ],
  },
  {
    id: 'minador',
    tecnico: 'Síntoma compatible con minador de la hoja (Leucoptera coffeella)',
    sencillo: 'manchas secas marrones en la hoja, como quemada o como papel',
    patrones: [
      /quemad/, /como (papel|tostad)/, /caminit/, /tunel/, /\bminador/, /manchas? (marron|cafe|secas?)/,
      /hoja seca/, /se (le )?(secan|seca) las hojas/,
    ],
  },
  {
    id: 'ojo_de_gallo',
    tecnico: 'Síntoma compatible con ojo de gallo (Mycena citricolor)',
    sencillo: 'manchas redonditas claras en la hoja, sobre todo con mucha sombra y humedad',
    patrones: [/ojo de gallo/, /ojit/, /redond/, /circul/, /manchas? (claras?|blancas?|grises?) redond/],
  },
  {
    id: 'mancha_hierro',
    tecnico: 'Síntoma compatible con mancha de hierro (Cercospora coffeicola)',
    sencillo: 'manchas con centro claro y borde oscuro, también en los granos',
    patrones: [/mancha de hierro/, /cercospor/, /centro (blanco|gris|claro)/, /borde (rojiz|morad|oscur)/, /granos? manchad/],
  },
  {
    id: 'muerte_descendente',
    tecnico: 'Síntoma compatible con muerte descendente / antracnosis',
    sencillo: 'ramas que se secan desde la punta hacia abajo',
    patrones: [
      /desde la punta/, /de (arriba|la punta) (para|pa|hacia) abajo/, /ramas? sec/, /palos? sec/,
      /se (esta|estan) secando (las ramas|la mata|las matas)/, /antracnos/,
    ],
  },
  {
    id: 'come_hojas',
    tecnico: 'Daño por insectos que mastican la hoja (p. ej. bachaco / hormiga cortadora, gusanos)',
    sencillo: 'hojas comidas, mordidas o cortadas por bichos',
    patrones: [/comid/, /mordid/, /mordisque/, /bachac/, /hormig/, /cortad/, /se (las )?(estan )?comiendo/, /huecos? en las hojas/, /hojas? (picad|rot)/, /se (las )?llevan/],
  },
  {
    id: 'nutricion',
    tecnico: 'Posible deficiencia nutricional o de suelo (requiere revisión)',
    sencillo: 'hojas pálidas o amarillas parejas, matas débiles, poca carga',
    patrones: [
      /hojas? (amarill|palid|descolorid)/, /matas? (flac|debil|chiquit|raquitic)/, /no (cargo|esta cargando|dio)/,
      /poca (cosecha|carga)/, /(bajo|bajaron|cayo|cayeron) (la cosecha|el rendimiento|la produccion)/, /amarillent/,
    ],
  },
];

// ---------- Maíz (paquete 2) ----------
// Categorías conservadoras: varias son "compatibles con" y piden revisión del técnico.
const SINTOMAS_MAIZ = [
  {
    id: 'cogollero',
    tecnico: 'Síntoma compatible con gusano cogollero (Spodoptera frugiperda)',
    sencillo: 'el cogollo comido, con huecos y como aserrín, a veces con un gusano adentro',
    patrones: [/cogoller/, /cogollo/, /aserrin/, /gusano (en|dentro)/, /hojas? (comid|agujerad|rot)/, /huecos? en las hojas/, /se (le )?(esta|estan) comiendo/],
  },
  {
    id: 'raiz_maiz',
    tecnico: 'Daño en raíz compatible con gallina ciega o gusano alfilerillo (Diabrotica)',
    sencillo: 'matas que se marchitan o se caen, con gusanos blancos o raíces comidas',
    patrones: [/gallina ciega/, /alfiler/, /raic/, /raiz/, /se (estan )?(cayendo|acostando|volteando) las matas/, /gusanos? blanco/, /marchit/],
  },
  {
    id: 'mazorca',
    tecnico: 'Mazorca dañada: compatible con gusano de la mazorca o pudrición (requiere revisión)',
    sencillo: 'mazorcas comidas en la punta, podridas o con moho',
    patrones: [/mazorc/, /jojoto/, /podrid/, /moho/, /hongo/, /punta de la mazorca/],
  },
  {
    id: 'gorgojo',
    tecnico: 'Plaga de grano almacenado compatible con gorgojo del maíz (Sitophilus zeamais)',
    sencillo: 'el maíz guardado tiene gorgojos, huequitos y polvillo',
    patrones: [/gorgoj/, /guardad/, /almacen/, /en el saco/, /polvillo .{0,15}grano/, /grano guardado/],
  },
  {
    id: 'sequia_maiz',
    tecnico: 'Estrés por falta de agua (hojas enrolladas / secas)',
    sencillo: 'hojas enrolladas o secas por la falta de lluvia',
    patrones: [/enrollad/, /enrosc/, /no ha llovido/, /sequia/, /falta de agua/, /se (esta|estan) secando/],
  },
  {
    id: 'nutricion_maiz',
    tecnico: 'Posible deficiencia nutricional o de suelo en maíz (requiere revisión)',
    sencillo: 'matas amarillas o moradas, chiquitas, con mazorcas pequeñas',
    patrones: [/amarill/, /morad/, /palid/, /chiquit/, /no (crecen|crecio|creció)/, /mazorcas? (pequen|chiquit)/],
  },
  {
    id: 'manchas_maiz',
    tecnico: 'Manchas en hojas: posible enfermedad foliar (p. ej. mancha de asfalto, tizón, roya común) — requiere revisión',
    sencillo: 'manchas o rayas en las hojas (negras, marrones o como óxido)',
    patrones: [/manchas?/, /asfalto/, /raya/, /tizon/, /puntos negros/, /oxid/],
  },
];

SINTOMAS_CAFE.forEach((s) => { s.cultivo = 'cafe'; });
SINTOMAS_MAIZ.forEach((s) => { s.cultivo = 'maiz'; });
export const SINTOMAS = [...SINTOMAS_CAFE, ...SINTOMAS_MAIZ];
export const sintomasDe = (cultivo) => (cultivo === 'maiz' ? SINTOMAS_MAIZ : SINTOMAS_CAFE);

export const CULTIVOS = [
  { id: 'cafe', nombre: 'Café', patrones: [/\bcafe/, /cafetal/, /cereza/, /\bpepa/] },
  { id: 'platano', nombre: 'Plátano / cambur', patrones: [/platan/, /cambur/, /guineo/] },
  { id: 'maiz', nombre: 'Maíz', patrones: [/\bmaiz/, /mazorca/, /jojoto/, /maizal/, /cogollo/] },
  { id: 'caraota', nombre: 'Caraota', patrones: [/caraota/, /frijol/] },
  { id: 'yuca', nombre: 'Yuca', patrones: [/\byuca/] },
];

export const PARTES = [
  { id: 'hoja', nombre: 'Hojas', patrones: [/hoj/] },
  { id: 'grano', nombre: 'Granos / frutos / mazorca', patrones: [/grano/, /cereza/, /\bpepa/, /fruto/, /mazorc/] },
  { id: 'rama', nombre: 'Ramas / tallo / cogollo', patrones: [/rama/, /\bpalo/, /tallo/, /cogollo/, /cana/] },
  { id: 'raiz', nombre: 'Raíz', patrones: [/raiz/, /raices/] },
  { id: 'flor', nombre: 'Flores', patrones: [/\bflor/] },
];

export const EXTENSION = [
  { id: 3, nombre: 'Todo o casi todo el cultivo', patrones: [/todo el (cafetal|conuco|cultivo|lote|terreno)/, /todas las matas/, /casi todas/, /en todas partes/] },
  { id: 2, nombre: 'Una parte del cultivo', patrones: [/la mitad/, /bastantes/, /muchas matas/, /varias matas/, /un lote/, /las de (arriba|abajo)/, /matas de (arriba|abajo)/, /parte de/] },
  { id: 1, nombre: 'Pocas matas', patrones: [/unas? pocas/, /algunas matas/, /una mata/, /dos matas/, /tres matas/, /poquit/] },
];

export const CLIMA = [
  { id: 'lluvia', nombre: 'Después de mucha lluvia', patrones: [/llov/, /lluvi/, /aguacero/, /palo de agua/, /humed/] },
  { id: 'sequia', nombre: 'Durante sequía / verano fuerte', patrones: [/sequia/, /verano/, /no (ha )?llov/, /mucho sol/, /calor/] },
  { id: 'frio', nombre: 'Después de frío / helada', patrones: [/helad/, /mucho frio/, /neblina/] },
];

// Tiempo: "desde hace 2 semanas", "hace unos días", "desde el mes pasado"
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, quince: 15 };
export function extraerDias(t) {
  const m = t.match(/(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|quince)\s+(dia|semana|mes)/);
  if (m) {
    const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : NUM[m[1]];
    return n * ({ dia: 1, semana: 7, mes: 30 }[m[2]]);
  }
  if (/unos dias|pocos dias|esta semana/.test(t)) return 4;
  if (/mes pasado/.test(t)) return 30;
  return null;
}
