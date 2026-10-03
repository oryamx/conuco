import { ZONAS, getCooperativa, getAlertas, aprobarAlerta, borrarTodo, escuchar, getCorrecciones, corregir } from './store.js';
import { SINTOMAS } from './lexicon.js';

const $ = (id) => document.getElementById(id);
const DIA = 86400000;
const UMBRAL = { reportes: 5, fincas: 3, dias: 14 };
const COLOR = { roya: '#d9711c', broca: '#5b3a29', minador: '#8a6d1f', ojo_de_gallo: '#7b8794', mancha_hierro: '#8e2c48', muerte_descendente: '#4a4a4a', nutricion: '#d4b106', no_claro: '#b3261e' };
const NOMBRE = Object.fromEntries(SINTOMAS.map((s) => [s.id, s.sencillo]));
NOMBRE.no_claro = 'no queda claro (revisar)';
const CORTO = { roya: 'roya', broca: 'broca', minador: 'minador', ojo_de_gallo: 'ojo de gallo', mancha_hierro: 'mancha de hierro', muerte_descendente: 'ramas secas', nutricion: 'hojas amarillas / poca carga', no_claro: 'no claro' };

// Mensaje para el agricultor: sencillo, sin términos técnicos, sin recetas de agroquímicos.
const CONSEJO = {
  roya: 'Revise la parte de abajo de las hojas. Si ve polvillo naranja, anote cuántas matas y avísele al técnico. No aplique productos sin consultar.',
  broca: 'Recoja los granos caídos y los que tengan huequito, no los deje en el suelo. El técnico pasará por la zona.',
  minador: 'Fíjese si las manchas secas aumentan. El técnico revisará en su próxima visita.',
  ojo_de_gallo: 'Si su cafetal tiene mucha sombra y humedad, avísele al técnico para revisar juntos.',
  mancha_hierro: 'Anote si también ve manchas en los granos y avísele al técnico.',
  muerte_descendente: 'Marque las matas con ramas secas y avísele al técnico.',
  nutricion: 'El técnico puede ayudar a revisar el suelo. Anote qué lotes están más débiles.',
};

let sinteticos = [];
const mapa = L.map('mapa', { scrollWheelZoom: false }).setView([9.1, -70.3], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15, attribution: '© OpenStreetMap' }).addTo(mapa);
const capa = L.layerGroup().addTo(mapa);

function todos() {
  const ahora = Date.now();
  const sint = $('verSint').checked ? sinteticos.map((r) => ({ ...r, fecha: ahora - r.hace_dias * DIA - 3600000 })) : [];
  const reales = getCooperativa().map((r) => {
    const z = ZONAS[r.zona] || ZONAS.BO;
    const semilla = [...(r.id || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
    return { ...r, lat: r.lat ?? z.lat + ((semilla % 50) - 25) / 1000, lng: r.lng ?? z.lng + ((semilla % 37) - 18) / 1000 };
  });
  const corr = getCorrecciones();
  return [...sint, ...reales].map((r) => {
    const c = corr[r.id];
    if (!c) return r;
    const s = SINTOMAS.find((x) => x.id === c.sintoma);
    return { ...r, sintoma_ia: r.sintoma, sintoma: c.sintoma, validado: true, corregido_tecnico: c.sintoma !== r.sintoma,
      sintoma_tecnico: s ? s.tecnico : 'No es un problema del cultivo / descartado', descartado: c.sintoma === 'descartado' };
  }).filter((r) => ahora - r.fecha <= 30 * DIA).sort((a, b) => b.fecha - a.fecha);
}

function detectarBrotes(reps) {
  const ahora = Date.now();
  const grupos = {};
  reps.filter((r) => ahora - r.fecha <= UMBRAL.dias * DIA && r.sintoma !== 'no_claro' && !r.descartado).forEach((r) => {
    const k = r.zona + '|' + r.sintoma;
    (grupos[k] ||= []).push(r);
  });
  return Object.entries(grupos)
    .map(([k, rs]) => ({ zona: k.split('|')[0], sintoma: k.split('|')[1], reportes: rs.length, fincas: new Set(rs.map((r) => r.finca)).size, reales: rs.filter((r) => !r.sintetico).length, clima: rs.filter((r) => r.clima === 'lluvia').length }))
    .filter((b) => b.reportes >= UMBRAL.reportes && b.fincas >= UMBRAL.fincas)
    .sort((a, b) => b.reportes - a.reportes);
}

function mensaje(b) {
  const z = ZONAS[b.zona].nombre.split(' (')[0];
  const lluvia = b.clima >= 2 ? ' después de las lluvias' : '';
  return `Atención caficultores de ${z}: ${b.fincas} fincas reportaron ${NOMBRE[b.sintoma]}${lluvia} en las últimas dos semanas. ${CONSEJO[b.sintoma] || ''}`;
}

let encuadrado = false;
function pintar() {
  const reps = todos();
  const brotes = detectarBrotes(reps);
  const aprobadas = getAlertas();
  $('kRep').textContent = reps.length;
  $('kFin').textContent = new Set(reps.map((r) => r.finca)).size;
  $('kRev').textContent = reps.filter((r) => r.confianza !== 'alta' && !r.validado).length;
  const validados = reps.filter((r) => r.validado);
  $('kEnt').textContent = validados.length;
  $('kCorr').textContent = validados.filter((r) => r.corregido_tecnico).length;
  $('kAle').textContent = brotes.length;

  capa.clearLayers();
  reps.forEach((r) => {
    L.circleMarker([r.lat, r.lng], {
      radius: r.sintetico ? 6 : 10, color: r.sintetico ? '#fff' : '#000', weight: r.sintetico ? 1 : 3,
      fillColor: COLOR[r.sintoma] || '#999', fillOpacity: 0.85,
    }).bindPopup(`${r.foto ? `<img src="${r.foto}" style="width:180px;border-radius:8px;display:block;margin-bottom:6px">` : ''}<b>${CORTO[r.sintoma] || r.sintoma}</b> · ${r.sintetico ? 'sintético' : 'reporte real de la app'}<br>“${r.texto_original}”<br><small>${new Date(r.fecha).toLocaleDateString('es-VE')} · confianza ${r.confianza}</small>`).addTo(capa);
  });
  if (!encuadrado && reps.length) { mapa.fitBounds(L.latLngBounds(reps.map((r) => [r.lat, r.lng])).pad(0.15)); encuadrado = true; }
  $('leyenda').innerHTML = Object.entries(CORTO).map(([k, v]) => `<span><i style="background:${COLOR[k]}"></i>${v}</span>`).join('') + '<span>● borde negro = reporte real</span>';

  $('alertas').innerHTML = brotes.length ? brotes.map((b, i) => {
    const ya = aprobadas.find((a) => a.zona === b.zona && a.sintoma === b.sintoma);
    return `<div class="tarjeta alerta ${ya ? 'enviada' : ''}">
      <h3>${ya ? '✅' : '🚨'} Posible brote de <b>${CORTO[b.sintoma]}</b> en ${ZONAS[b.zona].nombre}</h3>
      <div class="pista">${b.reportes} reportes · ${b.fincas} fincas · últimos 14 días${b.reales ? ` · ${b.reales} desde la app` : ''}</div>
      <div class="msg">📢 ${mensaje(b)}</div>
      ${ya ? '<div class="pista">Enviado por SMS y voz a las fincas de la zona.</div>' : `<button class="btn si" data-b="${i}">Revisé: aprobar y enviar (SMS + voz)</button>`}
    </div>`;
  }).join('') : '<div class="tarjeta pista">Sin alertas por ahora.</div>';
  $('alertas').querySelectorAll('[data-b]').forEach((btn) => btn.addEventListener('click', () => {
    const b = brotes[+btn.dataset.b];
    aprobarAlerta({ zona: b.zona, sintoma: b.sintoma, mensaje: mensaje(b) });
    pintar();
  }));

  const recientes = reps.slice(0, 25);
  const opciones = (sel) => [...SINTOMAS.map((x) => [x.id, CORTO[x.id]]), ['no_claro', 'no claro'], ['descartado', 'no es problema / descartar']]
    .map(([id, n]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${n}</option>`).join('');
  $('lista').innerHTML = '<tr><th>Cuándo</th><th>Zona</th><th>Foto</th><th>Lo que dijo el agricultor</th><th>Cómo lo anotó Conuco</th><th>Confianza</th><th>Revisión del técnico</th></tr>' +
    recientes.map((r) => `<tr class="${!r.sintetico && Date.now() - r.recibido < 120000 ? 'nuevo' : ''}">
      <td>${new Date(r.fecha).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}</td>
      <td>${ZONAS[r.zona]?.nombre.split(' (')[0] || r.zona}</td>
      <td>${r.foto ? `<a href="${r.foto}" target="_blank"><img src="${r.foto}" style="width:56px;height:56px;object-fit:cover;border-radius:8px"></a>` : '<span class="pista">—</span>'}</td>
      <td>“${r.texto_original}” ${r.sintetico ? '<span class="tag">sintético</span>' : '<span class="tag" style="background:#e5f0e3">app</span>'}</td>
      <td>${r.sintoma_tecnico}${r.corregido_tecnico ? `<br><span class="pista">IA dijo: ${CORTO[r.sintoma_ia] || r.sintoma_ia}</span>` : ''}</td>
      <td><span class="conf ${r.confianza}">${r.confianza}</span></td>
      <td>${r.validado ? `<span class="conf alta">✔ ${r.corregido_tecnico ? 'corregido' : 'validado'}</span>` : `<select data-id="${r.id}" style="padding:6px;font-size:.8rem">${opciones(r.sintoma)}</select>
        <button class="btn si" data-validar="${r.id}" style="padding:6px 10px;font-size:.8rem;margin-top:4px">Validar</button>`}</td></tr>`).join('');
  $('lista').querySelectorAll('[data-validar]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.validar;
    corregir(id, { sintoma: $('lista').querySelector(`select[data-id="${id}"]`).value });
    pintar();
  }));
}

$('verSint').addEventListener('change', pintar);
$('descargar').addEventListener('click', () => {
  const lineas = todos().filter((r) => r.validado && !r.descartado && r.sintoma !== 'no_claro')
    .map((r) => `${r.sintoma} | ${r.texto_original.replace(/\n/g, ' ')}`);
  const blob = new Blob([lineas.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'frases_validadas.txt'; a.click();
});
$('reiniciar').addEventListener('click', (e) => { e.preventDefault(); if (confirm('¿Borrar los reportes y alertas de la demo en este dispositivo?')) { borrarTodo(); pintar(); } });
escuchar(() => pintar());
window.addEventListener('storage', pintar);

fetch('reportes_sinteticos.json').then((r) => r.json()).then((d) => { sinteticos = d; pintar(); });
