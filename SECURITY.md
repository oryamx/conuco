# Conuco — Security review & tests

Conuco collects reports from farmers through three channels (app, SMS, voice call) and turns them into alerts that a cooperative sends back to whole communities. The main risks are therefore **false alerts**, **poisoned training data**, **code injection into the cooperative's panel** and **privacy of farmers** — in a country where a registry of who grows what, and where, can be sensitive.

## Threat model (prototype)
| Threat | Example | Control in Conuco |
|---|---|---|
| Stored XSS in the cooperative panel | A report with `<img onerror=…>` as the farmer's text | All untrusted fields escaped; photo must be a JPEG data URL; **Content-Security-Policy** blocks inline and third-party scripts (defense in depth) |
| Tampered / malformed reports | Unknown symptom, zone, future date, `javascript:` photo, huge text | Strict schema validation on reception (`seguridad.js → validarReporte`), re-validated before display; text capped at 500 chars; photo ≤ ~200 KB |
| Forged SMS | Someone sends a report in another farm's name | Each farm gets a secret key at registration; SMS carries a truncated **HMAC-SHA256** signature; constant-time comparison |
| Replayed SMS | Re-sending a valid SMS to inflate counts | Used signatures are remembered and rejected |
| Fake outbreak (alert flooding) | One farm sends 10 reports; or 6 unregistered numbers report the same thing | Only **registered** farms count; max 3 reports/farm/day and max 2 reports/farm per possible outbreak; ≥5 reports **and** ≥3 farms; **a technician must approve every alert** |
| Training-data poisoning | Spam phrases end up in the retraining set | Only phrases **validated by a technician** are exported; export sanitizes separators/new lines |
| Supply chain | Speech model changed upstream | Whisper loaded only from an allow-list at a **pinned commit**; JS libraries vendored (transformers.js 3.7.1, Leaflet 1.9.4) |
| Privacy | Location in photo metadata; voice notes; shared phones | Photos re-encoded to JPEG (drops EXIF/GPS); **voice notes never leave the phone**; reports carry a farm code, not a name; consent at registration; "Delete my data" button |
| Caller-ID spoofing (voice line) | Calling from a spoofed number | Unregistered numbers are accepted but **don't count for alerts**; human approval of alerts. Next step: a short PIN per farm |

## Automated tests — `pruebas/seguridad.test.mjs` (Playwright + Chromium)
**21 / 21 passing** (see `pruebas/resultados.json`).

| ID | Test | Result |
|---|---|---|
| T1 | Stored XSS through the farmer's text → panel | ✅ rendered as text, not executed |
| T2 | Tampered stored records (id, symptom, zone, `javascript:` / SVG photo, future date) | ✅ rejected, not shown |
| T3 | Corrupted local storage (invalid JSON / wrong types) | ✅ app and panel keep working |
| T4 | Legitimate signed SMS | ✅ accepted |
| T5 | Replayed SMS | ✅ rejected |
| T6 | Modified SMS (rust → borer, same signature) | ✅ rejected: invalid signature |
| T7 | SMS from unregistered farm | ✅ rejected |
| T8 | SMS with changed zone | ✅ rejected |
| T9 | Malformed / script / over-long SMS | ✅ rejected, nothing executed; all rejections logged (audit) |
| T10 | One farm floods 10 reports (+2 legit farms) | ✅ no false outbreak |
| T10b | 6 unregistered farms report the same | ✅ no alert |
| T10c | Positive control: 5 registered farms | ✅ alert raised |
| T11 | Photo re-encoded to small JPEG (metadata removed) | ✅ |
| T12 | 5,000-character text | ✅ truncated to 500 |
| T13 | Voice line from unregistered number | ✅ received, flagged, not counted |
| T13b | Voice line: AI doesn't understand → keypad menu | ✅ report saved by keypad choice |
| T14 | CSP blocks injected inline / third-party scripts | ✅ |
| T15 | Speech engine refuses non-allow-listed models | ✅ |
| T16 | Retraining export can't be broken by `|` or new lines | ✅ |

**The tests catch real bugs:** we ran them against a deliberately weakened copy (escaping, signature check, spam caps and registration filter removed) and 4 tests failed as expected (T1, T6, T10, T10b). Note: even with escaping removed, the XSS payload did not run because the CSP blocked it — two independent layers.

**Found during review and fixed:** the first version of the panel rendered farmers' text with `innerHTML` without escaping (stored XSS). Fixed and covered by T1/T2.

## Known limitations (honest list)
- **No real backend yet.** In the prototype the cooperative is the panel on the same site (shared browser storage). Authentication of technicians, transport security of the sync, and server-side storage are not built.
- SMS signature is 32 bits (to fit in one SMS): enough against casual forgery, not against a determined attacker with many attempts → add rate limiting per number at the SMS gateway.
- Farm keys live in local storage (phone and panel). Production: issue keys via QR at in-person registration and store them in the platform keystore.
- Caller ID can be spoofed; mitigated by "doesn't count for alerts until registered" + human approval. Next: per-farm PIN.
- GitHub Pages can't send security headers (CSP is set via `<meta>`; no `frame-ancestors`/clickjacking protection).
- Model files from Hugging Face are pinned by commit but not hash-verified client-side.

## Run the tests
```bash
python3 -m http.server 8771            # in the project folder
npm i playwright                       # uses an installed Chromium
node pruebas/seguridad.test.mjs http://localhost:8771
```
