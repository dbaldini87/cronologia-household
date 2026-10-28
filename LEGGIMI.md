# Cronologia della Casa

Sito interattivo con la linea del tempo di *Household* fino alla Caduta di Faeriyev, pensato per i giocatori della nostra Saga della Fragile Pace.

## Com'è fatto

```
index.html        la pagina
stile.css         l'aspetto
app.js            la logica (non serve toccarla)
vendor/           libreria per leggere i file YAML
dati/
  sito.yaml         titolo, sottotitolo, evento iniziale, link al repository
  cronologia.yaml   gli eventi della linea del tempo e le avventure di ogni periodo
  personaggi.yaml   le personalità: i protagonisti, le figure della nostra Saga, le figure della Casa
  luoghi.yaml       nazioni, città e territori della Casa e del Giardino
  mondo.yaml        le pagine "La Casa" e "Il Giardino": Popoli, Nazioni e Fazioni
```

**Per aggiornare la cronologia si modificano solo i file nella cartella `dati/`.**

## Come modificare i dati

I file sono in YAML: testo semplice, si aprono con qualsiasi editor (Blocco note, VS Code…) o direttamente su GitHub con la matita "Edit".

Regole da ricordare:

- usa sempre **spazi**, mai il tasto Tab, e rispetta i rientri che vedi;
- i testi lunghi stanno dopo `riassunto: |` e vanno rientrati di due spazi in più;
- personaggi e luoghi si citano con il loro `id` (es. `protagonisti: [gwen, humphrey]`);
- dentro un testo puoi scrivere `[[gwen]]` per un collegamento cliccabile, oppure `[[gwen|la bibliotecaria]]` per cambiarne il testo; `**grassetto**` e `*corsivo*` funzionano.

### Annotare cosa è successo al vostro tavolo

Ogni evento, avventura, personaggio e luogo accetta un campo `campagna:`. Il testo compare in un riquadro "Nella nostra Saga", separato dal riassunto. Le righe che iniziano con `#` sono promemoria e non vengono mostrate: sotto ogni avventura giocata ce n'è già una, basta scrivere il testo subito sotto, con lo stesso rientro.

```yaml
      - titolo: Il Diario di Argo
        quando: Settembre VI A.C.
        luogo: wallford
        protagonisti: [gwen, humphrey, earnest, sienna]
        riassunto: |
          …
        campagna: |
          # Come è finita? Scrivilo qui sotto, rientrato come questa riga.
          Al nostro tavolo Sienna ha venduto la pagina del diario a un ricettatore
          e Gwen l'ha dovuta ricomprare a Chesterfield.
```

Puoi anche riscrivere direttamente i `riassunto`, spostare avventure, cambiare protagonisti o aggiungere eventi nuovi: la linea del tempo si ridisegna da sola, nell'ordine in cui gli eventi compaiono nel file.

### Aggiungere un evento alla linea del tempo

```yaml
  - id: matrimonio-di-pierre           # unico, minuscolo, senza spazi
    data: Giugno VIII A.C.
    capitolo: Capitolo III · Paragrafo I   # facoltativo
    titolo: Il Matrimonio di Pierre
    rilievo: minore                     # maggiore = chiave viola sopra la linea
    riassunto: |
      Testo del riassunto, con [[pierre]] e [[astraviya]].
    personaggi: [pierre, gunther]
    luoghi: [astraviya]
```

### Le pagine "La Casa" e "Il Giardino"

Stanno in `mondo.yaml`. Ogni sezione diventa una linguetta in alto; dentro ci sono gruppi (I Popoli, Le Nazioni…) e voci. Ogni voce ha `nome`, `motto`, `breve` (la riga mostrata nella pagina), `dati` (coppie "Etichetta: valore"), `descrizione` e `collegamenti` (id di personaggi, luoghi o altre voci). Con `luoghi_della_nazione: Reame` la scheda elenca da sola tutti i luoghi di quella nazione.

### Aggiungere un personaggio o un luogo

Copia una voce esistente in `personaggi.yaml` o `luoghi.yaml` e cambia `id` e testi. Per un ritratto, metti l'immagine in una cartella (es. `ritratti/gwen.webp`) e aggiungi `ritratto: ritratti/gwen.webp`.

Se scrivi un `id` che non esiste, il sito lo segnala in un riquadro rosso in alto, indicando dove si trova l'errore. Se un file YAML ha un errore di formattazione, il sito indica il file e la riga.

## Vedere il sito sul proprio computer

Aprire `index.html` con un doppio clic **non funziona**: il browser non permette di leggere i file `dati/` da disco. Serve un piccolo server locale. Con Python installato, dalla cartella del sito:

```
python -m http.server 8000
```

poi apri <http://localhost:8000> nel browser.

## Pubblicarlo su GitHub Pages

1. Su <https://github.com/new> crea un repository **pubblico** (es. `cronologia-household`). Le Pages gratuite richiedono un repository pubblico.
2. Nella pagina del repository vuoto scegli **uploading an existing file** e trascina dentro **tutto il contenuto** di questa cartella (file e sottocartelle, compreso `.nojekyll`). Conferma con **Commit changes**.
3. Vai in **Settings → Pages**, alla voce *Build and deployment* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, poi **Save**.
4. Dopo un paio di minuti il sito sarà online a `https://TUO-UTENTE.github.io/cronologia-household/`.
5. Facoltativo: in `dati/sito.yaml` scrivi `repository: TUO-UTENTE/cronologia-household` per avere in fondo alla pagina il link "Modifica la cronologia su GitHub".

Da quel momento puoi modificare i file `dati/*.yaml` direttamente su GitHub (matita "Edit this file", poi "Commit changes"): il sito si aggiorna da solo in un minuto o due.

Per condividere un punto preciso, copia l'indirizzo dalla barra del browser: contiene l'evento selezionato e la scheda aperta (es. `…/#e=cap-3-1&p=tubo`).

## Note

I riassunti sono scritti a partire da *Household* e *La Saga della Fragile Pace* di Two Little Mice. È un sito non ufficiale, fatto per il nostro tavolo: non caricare nel repository pubblico le illustrazioni o i PDF del gioco.
