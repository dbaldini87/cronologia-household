/* Cronologia della Casa — logica del sito.
   I contenuti stanno tutti nella cartella "dati": qui non serve toccare nulla. */
(() => {
  'use strict';

  const PASSO = 128;          // distanza tra due chiavi
  const MARGINE = 96;         // spazio ai bordi della linea
  const Y_EPOCHE = 410;       // prima riga delle bande d'epoca

  const S = {
    sito: {}, eventi: [], epoche: [],
    ev: new Map(), pers: new Map(), luo: new Map(),
    sel: null, scheda: null, mancanti: new Map(),
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String);
  const unici = (arr) => [...new Set(arr)];

  /* ── Caricamento ───────────────────────────────────────── */
  async function caricaYaml(nome) {
    let r;
    try { r = await fetch(`dati/${nome}`, { cache: 'no-cache' }); } catch (e) { r = null; }
    if (!r || !r.ok) throw new Error(`Non riesco a leggere il file dati/${nome}. Se stai aprendo il sito dal computer, avvialo con un piccolo server (vedi LEGGIMI).`);
    const testo = await r.text();
    try { return jsyaml.load(testo) || {}; }
    catch (e) {
      const riga = e.mark ? ` alla riga ${e.mark.line + 1}` : '';
      throw new Error(`Il file dati/${nome} contiene un errore${riga}: ${e.reason || e.message}. Controlla rientri e due punti.`);
    }
  }

  async function avvia() {
    try {
      const [sito, crono, pers, luoghi] = await Promise.all([
        caricaYaml('sito.yaml').catch(() => ({})),
        caricaYaml('cronologia.yaml'), caricaYaml('personaggi.yaml'), caricaYaml('luoghi.yaml'),
      ]);
      S.sito = sito || {};
      S.eventi = (crono.eventi || []).filter((e) => e && e.id);
      S.epoche = crono.epoche || [];
      S.eventi.forEach((e, i) => { e._i = i; e.avventure = (e.avventure || []).filter(Boolean); S.ev.set(String(e.id), e); });
      (Array.isArray(pers) ? pers : []).filter((p) => p && p.id).forEach((p) => S.pers.set(String(p.id), p));
      (Array.isArray(luoghi) ? luoghi : []).filter((l) => l && l.id).forEach((l) => S.luo.set(String(l.id), l));
    } catch (err) {
      $('#dettaglio').innerHTML = `<div class="testo"><h2>Gli archivi non si aprono</h2><p>${esc(err.message)}</p></div>`;
      return;
    }
    if (S.sito.titolo) { $('#titolo-sito').textContent = S.sito.titolo; document.title = S.sito.titolo; }
    $('#sottotitolo-sito').textContent = S.sito.sottotitolo || '';
    if (S.sito.repository) {
      const repo = String(S.sito.repository).replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
      $('#link-modifica').innerHTML = `<a href="https://github.com/${esc(repo)}/tree/main/dati">Modifica la cronologia su GitHub</a>`;
    }
    controlla();
    disegnaLinea();
    collegaEventi();
    const h = leggiHash();
    const iniziale = S.ev.has(h.e) ? h.e : S.ev.has(String(S.sito.evento_iniziale)) ? String(S.sito.evento_iniziale) : S.eventi[0] && S.eventi[0].id;
    if (iniziale) seleziona(iniziale, { scorri: 'centro', istantaneo: true });
    if (h.p && S.pers.has(h.p)) apriScheda('p', h.p);
    else if (h.l && S.luo.has(h.l)) apriScheda('l', h.l);
  }

  /* ── Controllo dei riferimenti ─────────────────────────── */
  function segnalaMancante(id, dove) {
    if (!S.mancanti.has(id)) S.mancanti.set(id, new Set());
    S.mancanti.get(id).add(dove);
  }
  function controllaTesto(testo, dove) {
    String(testo || '').replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, id) => {
      id = id.trim(); if (!S.pers.has(id) && !S.luo.has(id)) segnalaMancante(id, dove); return '';
    });
  }
  function controlla() {
    for (const e of S.eventi) {
      const dove = e.titolo || e.id;
      lista(e.personaggi).forEach((id) => S.pers.has(id) || segnalaMancante(id, dove));
      lista(e.luoghi).forEach((id) => S.luo.has(id) || segnalaMancante(id, dove));
      controllaTesto(e.riassunto, dove); controllaTesto(e.campagna, dove);
      for (const a of e.avventure) {
        const d2 = a.titolo || dove;
        [...lista(a.protagonisti), ...lista(a.altri)].forEach((id) => S.pers.has(id) || segnalaMancante(id, d2));
        lista(a.luogo).forEach((id) => S.luo.has(id) || segnalaMancante(id, d2));
        controllaTesto(a.riassunto, d2); controllaTesto(a.campagna, d2);
      }
    }
    for (const p of S.pers.values()) { lista(p.luoghi).forEach((id) => S.luo.has(id) || segnalaMancante(id, p.nome || p.id)); controllaTesto(p.profilo, p.nome || p.id); }
    for (const l of S.luo.values()) controllaTesto(l.descrizione, l.nome || l.id);
    for (const ep of S.epoche) [ep.da, ep.a].forEach((id) => id && !S.ev.has(String(id)) && segnalaMancante(String(id), `epoca ${ep.nome}`));
    if (!S.mancanti.size) return;
    const righe = [...S.mancanti].map(([id, dove]) => `<li><strong>${esc(id)}</strong> (in: ${esc([...dove].join(', '))})</li>`).join('');
    const box = $('#avvisi');
    box.innerHTML = `Alcuni id non corrispondono a nessuna voce di personaggi.yaml, luoghi.yaml o cronologia.yaml. Controlla l'ortografia o aggiungi la voce mancante:<ul>${righe}</ul>`;
    box.hidden = false;
  }

  /* ── Testi ─────────────────────────────────────────────── */
  function nomeDi(id) {
    if (S.pers.has(id)) return S.pers.get(id).nome || id;
    if (S.luo.has(id)) return S.luo.get(id).nome || id;
    return id;
  }
  function inline(t) {
    return esc(t)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, id, et) => {
        id = id.trim();
        const tipo = S.pers.has(id) ? 'p' : S.luo.has(id) ? 'l' : null;
        const testo = et ? et : esc(nomeDi(id));
        if (!tipo) return `<span class="rif mancante" title="Id sconosciuto: ${esc(id)}">${testo}</span>`;
        return `<button type="button" class="rif" data-${tipo}="${esc(id)}">${testo}</button>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  function testo(t) {
    if (!t) return '';
    return String(t).trim().split(/\n\s*\n/).map((p) => `<p>${inline(p.trim().replace(/\n/g, ' '))}</p>`).join('');
  }
  function boxCampagna(t) {
    if (!t || !String(t).trim()) return '';
    return `<div class="campagna"><h4>Nella nostra Saga</h4>${testo(t)}</div>`;
  }

  /* ── Gettoni ───────────────────────────────────────────── */
  function gettonePers(id) {
    const p = S.pers.get(id);
    if (!p) return `<span class="gettone mancante" title="Id sconosciuto">${esc(id)}</span>`;
    return `<button type="button" class="gettone" data-p="${esc(id)}" data-nazione="${slug(p.nazione)}"><span class="punto"></span>${esc(p.nome || id)}</button>`;
  }
  function gettoneLuogo(id) {
    const l = S.luo.get(id);
    if (!l) return `<span class="gettone mancante" title="Id sconosciuto">${esc(id)}</span>`;
    return `<button type="button" class="gettone luogo" data-l="${esc(id)}" data-nazione="${slug(l.nazione)}"><span class="punto"></span>${esc(l.nome || id)}</button>`;
  }

  /* ── Linea del tempo ───────────────────────────────────── */
  function svgChiave(maggiore) {
    const H = maggiore ? 132 : 100, w = 44, cx = 22;
    const r = maggiore ? 11 : 9, cy = maggiore ? 16 : 13;
    const fregi = maggiore
      ? `<circle cx="${cx}" cy="${cy}" r="3.6" fill="currentColor"/><circle cx="${cx}" cy="1.5" r="2.6" fill="currentColor"/><circle cx="${cx - 13}" cy="${cy}" r="2.2" fill="currentColor"/><circle cx="${cx + 13}" cy="${cy}" r="2.2" fill="currentColor"/>`
      : '';
    const top = cy + r + 1;
    return `<svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true">
      <circle class="anello-sel" cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="${maggiore ? 3.6 : 3}"/>
      ${fregi}
      <rect x="${cx - 7}" y="${top}" width="14" height="4" rx="1.5" fill="currentColor"/>
      <rect x="${cx - 2}" y="${top + 4}" width="4" height="${H - top - 4}" fill="currentColor"/>
      <rect x="${cx + 2}" y="${H - 24}" width="${maggiore ? 11 : 9}" height="6" fill="currentColor"/>
      <rect x="${cx + 2}" y="${H - 13}" width="${maggiore ? 7 : 6}" height="6" fill="currentColor"/>
    </svg>`;
  }

  const xDi = (i) => MARGINE + i * PASSO;

  function disegnaLinea() {
    const interno = $('#linea-interno');
    const larghezza = xDi(S.eventi.length - 1) + MARGINE;
    // righe delle epoche
    const bande = [];
    const righe = [];
    for (const ep of S.epoche) {
      const a = S.ev.get(String(ep.da)), b = S.ev.get(String(ep.a));
      if (!a || !b) continue;
      const x1 = xDi(Math.min(a._i, b._i)) - 40, x2 = xDi(Math.max(a._i, b._i)) + 40;
      let riga = righe.findIndex((fine) => fine < x1);
      if (riga === -1) { riga = righe.length; righe.push(0); }
      righe[riga] = x2 + 10;
      bande.push(`<div class="epoca" style="left:${x1}px;width:${x2 - x1}px;top:${Y_EPOCHE + riga * 30}px"><span>${esc(ep.nome)}</span></div>`);
    }
    const altezza = Y_EPOCHE + Math.max(1, righe.length) * 30 + 10;
    interno.style.width = `${larghezza}px`;
    interno.style.height = `${altezza}px`;
    document.documentElement.style.setProperty('--altezza-linea', `${altezza}px`);

    const chiavi = S.eventi.map((e, i) => {
      const maggiore = String(e.rilievo || '').toLowerCase().startsWith('magg');
      const lato = maggiore ? 'sopra' : 'sotto';
      const capBreve = String(e.capitolo || '').replace(/Capitolo/g, 'Cap.').replace(/Paragrafo/g, 'Par.');
      const cap = e.capitolo ? `<span class="capitolo-chiave">${esc(capBreve)}</span>` : '';
      return `<button type="button" role="option" aria-selected="false" class="chiave ${lato} ${maggiore ? 'maggiore' : 'minore'}" style="left:${xDi(i)}px" data-e="${esc(e.id)}" id="chiave-${esc(e.id)}" tabindex="-1">
        <span class="etichetta">${cap ? cap + '<br>' : ''}<span class="titolo-chiave">${esc(e.titolo)}</span></span>
        ${svgChiave(maggiore)}
        <span class="data-chiave">${esc(e.data)}</span>
      </button>`;
    }).join('');
    interno.innerHTML = `<div class="asse"></div>${bande.join('')}${chiavi}`;
  }

  function seleziona(id, opz = {}) {
    const e = S.ev.get(String(id));
    if (!e) return;
    S.sel = e;
    document.querySelectorAll('.chiave').forEach((k) => {
      const sì = k.dataset.e === String(id);
      k.setAttribute('aria-selected', sì ? 'true' : 'false');
      k.tabIndex = sì ? 0 : -1;
    });
    disegnaDettaglio(e);
    scriviHash();
    if (opz.scorri) {
      const box = $('#linea-scorrevole');
      const x = xDi(e._i) - box.clientWidth / 2;
      box.scrollTo({ left: Math.max(0, x), behavior: opz.istantaneo ? 'auto' : 'smooth' });
    }
    if (opz.fuoco) $(`#chiave-${CSS.escape(String(id))}`)?.focus({ preventScroll: true });
  }

  /* ── Dettaglio di un evento ────────────────────────────── */
  function personaggiEvento(e) {
    return unici([...lista(e.personaggi), ...e.avventure.flatMap((a) => [...lista(a.protagonisti), ...lista(a.altri)])]);
  }
  function luoghiEvento(e) {
    return unici([...lista(e.luoghi), ...e.avventure.flatMap((a) => lista(a.luogo))]);
  }
  function gruppiPersonaggi(ids) {
    const gruppi = new Map();
    for (const id of ids) {
      const g = S.pers.get(id)?.gruppo || 'Altri';
      if (!gruppi.has(g)) gruppi.set(g, []);
      gruppi.get(g).push(id);
    }
    return gruppi;
  }

  function disegnaDettaglio(e) {
    const pers = personaggiEvento(e);
    const luoghi = luoghiEvento(e);
    const gruppi = gruppiPersonaggi(pers);
    const datazione = `${esc(e.data)}${e.capitolo ? ` <span class="cap">— ${esc(e.capitolo)}</span>` : ''}`;
    const avventure = e.avventure.length ? `
      <section class="avventure">
        <h3>Eventi di questo periodo</h3>
        ${e.avventure.map((a, i) => avventuraHtml(a, i)).join('')}
      </section>` : '';
    const blocchiPers = [...gruppi].map(([g, ids]) =>
      `${gruppi.size > 1 ? `<p class="sottogruppo">${esc(g)}</p>` : ''}${ids.map(gettonePers).join('')}`).join('');
    $('#dettaglio').innerHTML = `
      <article>
        <header class="dett-intestazione">
          <p class="dett-data">${datazione}</p>
          <h2>${esc(e.titolo)}</h2>
        </header>
        <div class="testo">${testo(e.riassunto)}</div>
        ${boxCampagna(e.campagna)}
        ${avventure}
      </article>
      <div class="lato">
        ${pers.length ? `<section><h3>Personalità</h3><div class="elenco">${blocchiPers}</div></section>` : ''}
        ${luoghi.length ? `<section><h3>Luoghi</h3><div class="elenco">${luoghi.map(gettoneLuogo).join('')}</div></section>` : ''}
        ${legenda()}
      </div>`;
  }

  function avventuraHtml(a, i) {
    const luogo = lista(a.luogo)[0];
    const prot = lista(a.protagonisti), altri = lista(a.altri);
    return `<details class="avventura" id="avv-${i}">
      <summary>
        <span class="avv-titolo">${esc(a.titolo)}</span>
        <span class="avv-quando">${esc(a.quando || '')}</span>
        ${luogo ? `<span class="avv-luogo">${esc(nomeDi(luogo))}</span>` : ''}
      </summary>
      <div class="avv-corpo">
        ${prot.length ? `<div class="avv-gruppo"><span class="etichetta-gruppo">Protagonisti</span>${prot.map(gettonePers).join('')}</div>` : ''}
        ${altri.length ? `<div class="avv-gruppo"><span class="etichetta-gruppo">Presenti</span>${altri.map(gettonePers).join('')}</div>` : ''}
        ${luogo ? `<div class="avv-gruppo"><span class="etichetta-gruppo">Dove</span>${gettoneLuogo(luogo)}</div>` : ''}
        <div class="testo">${testo(a.riassunto)}</div>
        ${boxCampagna(a.campagna)}
      </div>
    </details>`;
  }

  function legenda() {
    const naz = unici([...S.luo.values(), ...S.pers.values()].map((x) => x.nazione).filter(Boolean));
    const ordine = ['Reame', 'Focolare', 'Liberi Domini', 'Orda', 'Domini Comuni', 'Fuori dalla Casa'];
    naz.sort((a, b) => (ordine.indexOf(a) + 99) % 99 - (ordine.indexOf(b) + 99) % 99);
    return `<div class="legenda" aria-label="Colori delle nazioni">${naz.map((n) => `<span><i class="punto" data-nazione="${slug(n)}"></i>${esc(n)}</span>`).join('')}</div>`;
  }

  /* ── Schede di approfondimento ─────────────────────────── */
  function comparsePersonaggio(id) {
    const out = [];
    for (const e of S.eventi) {
      let trovato = false;
      e.avventure.forEach((a, i) => {
        const ruolo = lista(a.protagonisti).includes(id) ? 'Protagonista' : lista(a.altri).includes(id) ? 'Presente' : null;
        if (ruolo) { trovato = true; out.push({ e, i, titolo: a.titolo, data: a.quando || e.data, ruolo }); }
      });
      if (!trovato && lista(e.personaggi).includes(id)) out.push({ e, i: null, titolo: e.titolo, data: e.data, ruolo: 'Coinvolto' });
    }
    return out;
  }
  function comparseLuogo(id) {
    const out = [];
    for (const e of S.eventi) {
      let trovato = false;
      e.avventure.forEach((a, i) => {
        if (lista(a.luogo).includes(id)) { trovato = true; out.push({ e, i, titolo: a.titolo, data: a.quando || e.data, ruolo: lista(a.protagonisti).map(nomeDi).join(', ') }); }
      });
      if (!trovato && lista(e.luoghi).includes(id)) out.push({ e, i: null, titolo: e.titolo, data: e.data, ruolo: e.capitolo || '' });
    }
    return out;
  }
  function elencoComparse(arr) {
    if (!arr.length) return '<p class="c-ruolo">Non compare ancora nella cronologia.</p>';
    return `<ul class="comparse">${arr.map((c) => `<li><button type="button" data-vai="${esc(c.e.id)}" data-avv="${c.i ?? ''}">
      <span class="c-titolo">${esc(c.titolo)}</span><span class="c-data">${esc(c.data)}</span>
      ${c.ruolo ? `<span class="c-ruolo">${esc(c.ruolo)}</span>` : ''}</button></li>`).join('')}</ul>`;
  }
  function riga(dt, dd) { return dd ? `<dt>${esc(dt)}</dt><dd>${esc(dd)}</dd>` : ''; }

  function schedaPersonaggio(id) {
    const p = S.pers.get(id);
    const luoghi = lista(p.luoghi);
    return `
      <p class="scheda-tipo">${esc(p.gruppo || 'Personalità')}</p>
      <h2 id="cassetto-titolo">${esc(p.nome || id)}</h2>
      ${p.nome_completo ? `<p class="scheda-nome-completo">${esc(p.nome_completo)}</p>` : ''}
      ${p.ritratto ? `<img class="scheda-ritratto" src="${esc(p.ritratto)}" alt="Ritratto di ${esc(p.nome)}">` : ''}
      ${p.breve ? `<p class="scheda-breve">${inline(p.breve)}</p>` : ''}
      <dl class="scheda-dati">
        ${riga('Popolo', p.popolo)}${riga('Nazione', p.nazione)}${riga('Mestiere', p.mestiere)}
        ${riga('Età a inizio Saga', p.eta ? `${p.eta} anni` : '')}
      </dl>
      <div class="testo">${testo(p.profilo)}</div>
      ${boxCampagna(p.campagna)}
      ${luoghi.length ? `<h3>Luoghi legati</h3><div class="elenco">${luoghi.map(gettoneLuogo).join(' ')}</div>` : ''}
      <h3>Nella cronologia</h3>
      ${elencoComparse(comparsePersonaggio(id))}`;
  }

  function schedaLuogo(id) {
    const l = S.luo.get(id);
    const legati = [...S.pers.values()].filter((p) => lista(p.luoghi).includes(id)).map((p) => String(p.id));
    return `
      <p class="scheda-tipo">${esc([l.tipo, l.nazione].filter(Boolean).join(', '))}</p>
      <h2 id="cassetto-titolo">${esc(l.nome || id)}</h2>
      ${l.dove ? `<p class="scheda-nome-completo">${esc(l.dove)}</p>` : ''}
      ${l.immagine ? `<img class="scheda-ritratto" src="${esc(l.immagine)}" alt="${esc(l.nome)}">` : ''}
      <div class="testo">${testo(l.descrizione)}</div>
      ${boxCampagna(l.campagna)}
      ${legati.length ? `<h3>Personalità legate</h3><div class="elenco">${legati.map(gettonePers).join(' ')}</div>` : ''}
      <h3>Cosa è successo qui</h3>
      ${elencoComparse(comparseLuogo(id))}`;
  }

  function schedaIndice(tipo) {
    if (tipo === 'personaggi') {
      const gruppi = gruppiPersonaggi([...S.pers.keys()]);
      return `<p class="scheda-tipo">Indice</p><h2 id="cassetto-titolo">Personalità</h2>
        ${[...gruppi].map(([g, ids]) => `<div class="indice-gruppo"><h3>${esc(g)}</h3><div class="elenco">${ids.map(gettonePers).join(' ')}</div></div>`).join('')}`;
    }
    const perNaz = new Map();
    for (const l of S.luo.values()) {
      const n = l.nazione || 'Altro';
      if (!perNaz.has(n)) perNaz.set(n, []);
      perNaz.get(n).push(String(l.id));
    }
    return `<p class="scheda-tipo">Indice</p><h2 id="cassetto-titolo">Luoghi</h2>
      ${[...perNaz].map(([n, ids]) => `<div class="indice-gruppo"><h3>${esc(n)}</h3><div class="elenco">${ids.map(gettoneLuogo).join(' ')}</div></div>`).join('')}`;
  }

  let fuocoPrima = null;
  function apriScheda(tipo, id) {
    const html = tipo === 'p' ? schedaPersonaggio(id) : tipo === 'l' ? schedaLuogo(id) : schedaIndice(id);
    const c = $('#cassetto');
    if (!c.classList.contains('aperto')) fuocoPrima = document.activeElement;
    $('#cassetto-contenuto').innerHTML = html;
    $('.cassetto-pannello').scrollTop = 0;
    c.classList.add('aperto');
    c.setAttribute('aria-hidden', 'false');
    S.scheda = tipo === 'i' ? null : { tipo, id };
    scriviHash();
    $('.chiudi', c).focus({ preventScroll: true });
  }
  function chiudiScheda() {
    const c = $('#cassetto');
    if (!c.classList.contains('aperto')) return;
    c.classList.remove('aperto');
    c.setAttribute('aria-hidden', 'true');
    S.scheda = null;
    scriviHash();
    if (fuocoPrima && document.contains(fuocoPrima)) fuocoPrima.focus({ preventScroll: true });
  }

  /* ── Indirizzo (per condividere un link a un evento) ───── */
  function leggiHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    return { e: p.get('e'), p: p.get('p'), l: p.get('l') };
  }
  function scriviHash() {
    const p = new URLSearchParams();
    if (S.sel) p.set('e', S.sel.id);
    if (S.scheda) p.set(S.scheda.tipo, S.scheda.id);
    try { history.replaceState(null, '', `#${p.toString()}`); } catch (e) { /* anteprime senza history */ }
  }

  /* ── Interazioni ───────────────────────────────────────── */
  function collegaEventi() {
    const box = $('#linea-scorrevole');
    const interno = $('#linea-interno');

    document.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-e],[data-p],[data-l],[data-vai],[data-indice],[data-chiudi]');
      if (!t) return;
      if (t.hasAttribute('data-chiudi')) return chiudiScheda();
      if (t.dataset.indice) return apriScheda('i', t.dataset.indice);
      if (t.dataset.p) return apriScheda('p', t.dataset.p);
      if (t.dataset.l) return apriScheda('l', t.dataset.l);
      if (t.dataset.e) { if (box.dataset.trascinato === '1') return; return seleziona(t.dataset.e, { scorri: true }); }
      if (t.dataset.vai) {
        chiudiScheda();
        seleziona(t.dataset.vai, { scorri: true });
        const i = t.dataset.avv;
        const bersaglio = i !== '' ? $(`#avv-${i}`) : $('#dettaglio');
        if (bersaglio && bersaglio.tagName === 'DETAILS') bersaglio.open = true;
        bersaglio?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });

    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') chiudiScheda(); });

    interno.addEventListener('keydown', (ev) => {
      if (!S.sel) return;
      let i = S.sel._i;
      if (ev.key === 'ArrowRight') i++;
      else if (ev.key === 'ArrowLeft') i--;
      else if (ev.key === 'Home') i = 0;
      else if (ev.key === 'End') i = S.eventi.length - 1;
      else return;
      ev.preventDefault();
      i = Math.max(0, Math.min(S.eventi.length - 1, i));
      seleziona(S.eventi[i].id, { scorri: true, fuoco: true });
    });

    // frecce di scorrimento
    const aggiorna = () => {
      $('.scorri-sx').disabled = box.scrollLeft < 5;
      $('.scorri-dx').disabled = box.scrollLeft + box.clientWidth > box.scrollWidth - 5;
    };
    $('.scorri-sx').addEventListener('click', () => box.scrollBy({ left: -box.clientWidth * 0.7, behavior: 'smooth' }));
    $('.scorri-dx').addEventListener('click', () => box.scrollBy({ left: box.clientWidth * 0.7, behavior: 'smooth' }));
    box.addEventListener('scroll', aggiorna, { passive: true });
    addEventListener('resize', aggiorna);
    aggiorna();

    // trascinare la linea con il mouse
    let inizio = null;
    box.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      inizio = { x: ev.clientX, s: box.scrollLeft };
      box.dataset.trascinato = '0';
    });
    addEventListener('pointermove', (ev) => {
      if (!inizio) return;
      const dx = ev.clientX - inizio.x;
      if (Math.abs(dx) > 5) { box.dataset.trascinato = '1'; box.classList.add('trascina'); }
      if (box.dataset.trascinato === '1') box.scrollLeft = inizio.s - dx;
    });
    addEventListener('pointerup', () => {
      if (!inizio) return;
      inizio = null; box.classList.remove('trascina');
      setTimeout(() => { box.dataset.trascinato = '0'; }, 0);
    });
    // rotellina verticale → scorrimento orizzontale
    box.addEventListener('wheel', (ev) => {
      if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX) && !ev.shiftKey) {
        const prima = box.scrollLeft;
        box.scrollLeft += ev.deltaY;
        if (box.scrollLeft !== prima) ev.preventDefault();
      }
    }, { passive: false });
  }

  avvia();
})();
