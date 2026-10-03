// Diccionario campesino → término técnico.
// IMPORTANTE: borrador construido para el hackathon. Debe validarse con
// caficultores y agrónomos de cada zona antes de usarse en campo.
// Cada patrón es una expresión regular sobre texto normalizado (minúsculas, sin acentos).

export const SINTOMAS = [
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
    id: 'nutricion',
    tecnico: 'Posible deficiencia nutricional o de suelo (requiere revisión)',
    sencillo: 'hojas pálidas o amarillas parejas, matas débiles, poca carga',
    patrones: [
      /hojas? (amarill|palid|descolorid)/, /matas? (flac|debil|chiquit|raquitic)/, /no (cargo|esta cargando|dio)/,
      /poca (cosecha|carga)/, /(bajo|bajaron|cayo|cayeron) (la cosecha|el rendimiento|la produccion)/, /amarillent/,
    ],
  },
];

export const CULTIVOS = [
  { id: 'cafe', nombre: 'Café', patrones: [/\bcafe/, /cafetal/, /cereza/, /\bpepa/] },
  { id: 'platano', nombre: 'Plátano / cambur', patrones: [/platan/, /cambur/, /guineo/] },
  { id: 'maiz', nombre: 'Maíz', patrones: [/\bmaiz/, /mazorca/, /jojoto/] },
  { id: 'caraota', nombre: 'Caraota', patrones: [/caraota/, /frijol/] },
  { id: 'yuca', nombre: 'Yuca', patrones: [/\byuca/] },
];

export const PARTES = [
  { id: 'hoja', nombre: 'Hojas', patrones: [/hoj/] },
  { id: 'grano', nombre: 'Granos / frutos', patrones: [/grano/, /cereza/, /\bpepa/, /fruto/] },
  { id: 'rama', nombre: 'Ramas', patrones: [/rama/, /\bpalo/, /tallo/] },
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
