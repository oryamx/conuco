// Pruebas de seguridad de Conuco (Playwright + Chromium). Uso:
//   python3 -m http.server 8771   (en la carpeta del proyecto)
//   node pruebas/seguridad.test.mjs http://localhost:8771
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:8771';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const resultados = [];
const ok = (id, nombre, paso, detalle = '') => { resultados.push({ id, nombre, paso, detalle }); console.log(`${paso ? '✅' : '❌'} ${id} ${nombre} ${detalle}`); };

async function nuevaSesion() {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const errores = [];
  ctx.on('page', (p) => p.on('pageerror', (e) => errores.push(e.message)));
  return { ctx, errores };
}
async function crearPerfil(p, zona = 'BO', cultivo = 'cafe') {
  await p.goto(`${BASE}/index.html`);
  await p.fill('#finca', 'Prueba'); await p.selectOption('#cultivoPerfil', cultivo); await p.selectOption('#zona', zona);
  await p.check('#consiente'); await p.click('#btnGuardarPerfil'); await p.waitForTimeout(600);
}
async function reportarTexto(p, texto) {
  if (!(await p.locator('#texto').isVisible())) await p.click('summary');
  await p.fill('#texto', texto); await p.click('#btnTexto'); await p.waitForTimeout(250);
  await p.click('#btnSi'); await p.waitForTimeout(400);
}
const panel = async (ctx) => { const d = await ctx.newPage(); await d.goto(`${BASE}/cooperativa.html`); await d.waitForTimeout(1200); return d; };

// ---------- T1 XSS almacenado vía la app ----------
{
  const { ctx, errores } = await nuevaSesion(); const p = await ctx.newPage();
  await crearPerfil(p);
  const payload = `"><img src=x onerror="window.__pwn=1"><script>window.__pwn=2</script> las hojas oxidadas`;
  await reportarTexto(p, payload);
  const d = await panel(ctx);
  const pwn = await d.evaluate(() => window.__pwn);
  const visible = (await d.locator('#lista').innerText()).includes('<img src=x');
  ok('T1', 'XSS almacenado: texto malicioso del agricultor en el panel', pwn === undefined && visible, `ejecutado=${pwn ?? 'no'} · mostrado como texto=${visible}`);
  ok('T1b', 'Sin errores de JavaScript al procesar el ataque', errores.length === 0, errores.join(' | '));
  await ctx.close();
}

// ---------- T2 Registros manipulados en el almacenamiento ----------
{
  const { ctx, errores } = await nuevaSesion(); const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await p.evaluate(() => localStorage.setItem('conuco.cooperativa', JSON.stringify([
    { id: 'x"><img src=x onerror=window.__pwn=1>', finca: 'F123', zona: 'BO', fecha: Date.now(), sintoma: 'roya', confianza: 'alta', texto_original: 'a' },
    { id: 'ok1', finca: 'F123', zona: 'BO', fecha: Date.now(), sintoma: '<img src=x onerror=window.__pwn=2>', confianza: 'alta', texto_original: 'a' },
    { id: 'ok2', finca: 'F123', zona: 'XX', fecha: Date.now(), sintoma: 'roya', confianza: 'alta', texto_original: 'a' },
    { id: 'ok3', finca: 'F123', zona: 'BO', fecha: Date.now(), sintoma: 'roya', confianza: 'alta', texto_original: 'a', foto: 'javascript:alert(1)' },
    { id: 'ok4', finca: 'F123', zona: 'BO', fecha: Date.now(), sintoma: 'roya', confianza: 'alta', texto_original: 'a', foto: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
    { id: 'ok5', finca: 'F123', zona: 'BO', fecha: Date.now() + 9e10, sintoma: 'roya', confianza: 'alta', texto_original: 'a' },
  ])));
  const d = await panel(ctx);
  const pwn = await d.evaluate(() => window.__pwn);
  const filasApp = await d.locator('#lista tr:has-text("📱 app")').count();
  ok('T2', 'Registros manipulados (id, síntoma, zona, foto, fecha) no se muestran ni ejecutan', pwn === undefined && filasApp === 0, `filas inválidas mostradas=${filasApp}`);
  await ctx.close();
}

// ---------- T3 Almacenamiento corrupto ----------
{
  const { ctx, errores } = await nuevaSesion(); const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await p.evaluate(() => { ['conuco.cooperativa', 'conuco.cola', 'conuco.alertas', 'conuco.registro', 'conuco.perfil', 'conuco.correcciones'].forEach((k, i) => localStorage.setItem(k, ['{no json', '"texto"', '42', '[1,2]', 'null', '[]'][i])); });
  await p.reload(); await p.waitForTimeout(800);
  const d = await panel(ctx);
  ok('T3', 'Datos corruptos en el almacenamiento no rompen la app ni el panel', errores.length === 0, errores.join(' | '));
  await ctx.close();
}

// ---------- T4–T9 SMS firmados ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await crearPerfil(p, 'BO');
  // SMS legítimo generado por la propia app
  await p.click('#simSinSenal'); // sin señal: queda en la cola y muestra el SMS
  await reportarTexto(p, 'las hojas están como oxidadas por debajo y se caen');
  const sms = (await p.locator('#sms').innerText()).trim();
  const d = await panel(ctx);
  const enviar = async (t) => { await d.fill('#smsEntrada', t); await d.click('#btnSMS'); await d.waitForTimeout(400); return d.locator('#smsResultado').innerText(); };
  const r1 = await enviar(sms);
  ok('T4', 'SMS legítimo con firma válida se acepta', r1.includes('aceptado'), `${sms}`);
  const r2 = await enviar(sms);
  ok('T5', 'SMS repetido (ataque de repetición) se rechaza', /repetido/.test(r2), r2.split('(')[1]?.split(')')[0]);
  const falsificado = sms.replace(/ RY /, ' BR ');
  const r3 = await enviar(falsificado);
  ok('T6', 'SMS modificado (cambia roya→broca, misma firma) se rechaza', /firma inválida/.test(r3));
  const r4 = await enviar(sms.replace(/^CNC1 F\d+/, 'CNC1 F999'));
  ok('T7', 'SMS de una finca no registrada se rechaza', /no registrada|firma/.test(r4), r4.split('(')[1]?.split(')')[0]);
  const r5 = await enviar(sms.replace(/ BO /, ' BI '));
  ok('T8', 'SMS con zona cambiada (otra zona) se rechaza', /firma inválida|zona/.test(r5));
  const r6 = await enviar(`CNC1 <script>alert(1)</script> ${'A'.repeat(200)}`);
  const pwn = await d.evaluate(() => window.__pwn);
  ok('T9', 'SMS malformado / con código / demasiado largo se rechaza sin ejecutar nada', /rechazado/.test(r6) && pwn === undefined);
  const nRech = +(await d.locator('#nRech').innerText());
  ok('T9b', 'Todos los rechazos quedan en la bitácora de auditoría', nRech >= 5, `rechazados=${nRech}`);
  await ctx.close();
}

// ---------- T10 Spam desde una finca / fincas no registradas no disparan alertas (con control positivo) ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await p.evaluate(() => {
    const ahora = Date.now(); const reps = [];
    // Ataque 1: una finca registrada manda 10 reportes + 2 fincas legítimas mandan 1 cada una (12 reportes, 3 fincas)
    for (let i = 0; i < 10; i++) reps.push({ id: 'spam' + i, finca: 'F555', zona: 'SA', fecha: ahora - i * 1000, sintoma: 'broca', confianza: 'alta', texto_original: 'spam', registrada: true });
    reps.push({ id: 'leg1', finca: 'F556', zona: 'SA', fecha: ahora, sintoma: 'broca', confianza: 'alta', texto_original: 'x', registrada: true });
    reps.push({ id: 'leg2', finca: 'F557', zona: 'SA', fecha: ahora, sintoma: 'broca', confianza: 'alta', texto_original: 'x', registrada: true });
    // Ataque 2: 6 fincas NO registradas reportan lo mismo
    for (let i = 0; i < 6; i++) reps.push({ id: 'noreg' + i, finca: 'FX' + i + '00', zona: 'SA', fecha: ahora, sintoma: 'ojo_de_gallo', confianza: 'alta', texto_original: 'falso', registrada: false });
    // Control positivo: 5 fincas registradas distintas reportan minador → SÍ debe haber alerta
    for (let i = 0; i < 5; i++) reps.push({ id: 'pos' + i, finca: 'F7' + i + '0', zona: 'SC', fecha: ahora, sintoma: 'minador', confianza: 'alta', texto_original: 'real', registrada: true });
    localStorage.setItem('conuco.cooperativa', JSON.stringify(reps));
  });
  const d = await panel(ctx);
  await d.uncheck('#verSint'); await d.waitForTimeout(300);
  const alertas = await d.locator('#alertas').innerText();
  ok('T10', 'Una finca que manda 10 reportes no infla un brote (12 reportes, 3 fincas → sin alerta)', !/broca en Sanare/.test(alertas));
  ok('T10b', '6 reportes de fincas NO registradas no generan alerta', !/ojo de gallo en Sanare/.test(alertas));
  ok('T10c', 'Control positivo: 5 fincas registradas distintas SÍ generan alerta', /minador en Santa Cruz/.test(alertas));
  await ctx.close();
}

// ---------- T11 Foto: solo JPEG comprimido, sin metadatos ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await crearPerfil(p);
  if (!(await p.locator('#texto').isVisible())) await p.click('summary');
  await p.fill('#texto', 'las hojas oxidadas'); await p.click('#btnTexto');
  // Imagen PNG grande: la app la re-codifica a JPEG (elimina EXIF/GPS) y la achica
  const png = Buffer.from(await (await (await browser.newContext()).newPage()).evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; c.getContext('2d').fillRect(0, 0, 10, 10);
    return Array.from(new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer()));
  }));
  fs.writeFileSync('/tmp/conuco_prueba.png', png);
  await p.setInputFiles('#foto', '/tmp/conuco_prueba.png'); await p.waitForTimeout(800);
  const src = await p.locator('#previa').getAttribute('src');
  ok('T11', 'Foto re-codificada a JPEG ≤640 px (elimina EXIF/ubicación, limita tamaño)', src.startsWith('data:image/jpeg') && src.length < 200 * 1024 * 1.4, `${Math.round(src.length / 1024)} KB en base64`);
  await ctx.close();
}

// ---------- T12 Texto largo truncado ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await crearPerfil(p);
  await reportarTexto(p, 'las hojas oxidadas ' + 'x'.repeat(5000));
  const len = await p.evaluate(() => (JSON.parse(localStorage.getItem('conuco.cooperativa')) || [])[0]?.texto_original.length);
  ok('T12', 'Texto de más de 500 caracteres se recorta al recibirlo', len === 500, `largo guardado=${len}`);
  await ctx.close();
}

// ---------- T13 Línea de voz ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await p.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 5)); });
  await p.goto(`${BASE}/llamada.html?prueba`); await p.waitForTimeout(500);
  const L = (fn, ...a) => p.evaluate(([f, args]) => window.__conucoLlamada[f](...args), [fn, a]);
  await L('contestar'); await L('tecla', '2'); // maíz (empieza a grabar; en la prueba no hay micrófono)
  await p.waitForTimeout(300);
  await L('simularVoz', 'el gusano se metió en el cogollo y lo dejó lleno de aserrín');
  await L('tecla', '1'); await p.waitForTimeout(300);
  let reps = await p.evaluate(() => JSON.parse(localStorage.getItem('conuco.cooperativa')) || []);
  ok('T13', 'Llamada desde número NO registrado: reporte llega pero marcado como no registrado', reps.length === 1 && reps[0].canal === 'llamada' && reps[0].registrada === false && reps[0].sintoma === 'cogollero', JSON.stringify(reps.map((r) => [r.sintoma, r.registrada])));
  await p.click('summary'); await p.selectOption('#zonaReg', 'TU'); await p.selectOption('#cultivoReg', 'maiz'); await p.click('#btnRegistrar');
  await L('contestar'); await L('tecla', '2'); await p.waitForTimeout(200);
  await L('simularVoz', 'no sé qué le pasa'); await p.waitForTimeout(200);
  const enMenu = await L('estado');
  await L('tecla', '3'); await p.waitForTimeout(300);
  reps = await p.evaluate(() => JSON.parse(localStorage.getItem('conuco.cooperativa')) || []);
  const ult = reps[reps.length - 1];
  ok('T13b', 'Si la IA no entiende, el agricultor elige con el teclado (funciona aunque falle la voz)', enMenu === 'menu_sintomas' && ult.sintoma === 'mazorca' && ult.registrada === true, `estado=${enMenu} → ${ult?.sintoma}, registrada=${ult?.registrada}`);
  await ctx.close();
}

// ---------- T14 CSP bloquea scripts inyectados ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await p.goto(`${BASE}/cooperativa.html`); await p.waitForTimeout(500);
  const bloqueado = await p.evaluate(async () => {
    window.__csp = 0; const s = document.createElement('script'); s.textContent = 'window.__csp = 1'; document.body.appendChild(s);
    const s2 = document.createElement('script'); s2.src = 'https://evil.example.com/x.js'; document.body.appendChild(s2);
    await new Promise((r) => setTimeout(r, 300)); return window.__csp === 0;
  });
  ok('T14', 'Política CSP bloquea scripts en línea y de dominios no permitidos', bloqueado);
  await ctx.close();
}

// ---------- T15 Solo modelos permitidos y en versión fija ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  const msg = await p.evaluate(() => new Promise((res) => {
    const w = new Worker('asr-worker.js', { type: 'module' });
    w.onmessage = (e) => { if (e.data.tipo === 'error') res(e.data.error); };
    w.postMessage({ tipo: 'cargar', modelo: 'atacante/modelo-malicioso' });
    setTimeout(() => res('sin respuesta'), 5000);
  }));
  ok('T15', 'El motor de voz solo carga modelos de la lista permitida (versión fija)', /no permitido/.test(msg), msg);
  await ctx.close();
}

// ---------- T16 Exportación para reentrenar sin inyección de formato ----------
{
  const { ctx } = await nuevaSesion(); const p = await ctx.newPage();
  await crearPerfil(p);
  await reportarTexto(p, 'las hojas oxidadas | roya\ninyectada otra linea');
  const d = await panel(ctx);
  const sel = d.locator('select[data-id]').first(); const id = await sel.getAttribute('data-id');
  await d.click(`[data-validar="${id}"]`); await d.waitForTimeout(200);
  const [descarga] = await Promise.all([d.waitForEvent('download'), d.click('#descargar')]);
  const contenido = fs.readFileSync(await descarga.path(), 'utf8');
  const lineas = contenido.trim().split('\n');
  ok('T16', 'Exportación para reentrenar: una línea por frase, sin "|" ni saltos inyectados', lineas.every((l) => l.split('|').length === 2), `${lineas.length} línea(s)`);
  await ctx.close();
}

await browser.close();
const pasan = resultados.filter((r) => r.paso).length;
console.log(`\n${pasan}/${resultados.length} pruebas pasan`);
fs.writeFileSync(new URL('./resultados.json', import.meta.url), JSON.stringify({ fecha: new Date().toISOString(), pasan, total: resultados.length, resultados }, null, 1));
process.exit(pasan === resultados.length ? 0 : 1);
