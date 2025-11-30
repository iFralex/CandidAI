"use client"
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';


const Page = () => {
    const [lang, setLang] = useState("en")

    const content = {
        it: `# CandidAI - Documentazione Completa della Piattaforma

## Panoramica
**CandidAI** è una piattaforma innovativa progettata per aiutare i professionisti a ottenere colloqui di lavoro nelle aziende target attraverso l'intelligenza artificiale. Il sistema genera email personalizzate indirizzate ai recruiter più rilevanti, selezionati strategicamente in base al profilo dell'utente.

### Obiettivo Principale
Facilitare il contatto diretto con i recruiter delle aziende desiderate attraverso email altamente personalizzate, aumentando significativamente le probabilità di ottenere un colloquio.

---

## Il Problema che Risolviamo

### La Crisi del Mercato del Lavoro Moderno

#### L'Impatto Devastante dell'IA sui Profili Junior

Settori che solo pochi anni fa erano estremamente floridi e ricchi di opportunità anche per figure junior - come l'informatica e la finanza - oggi, con l'avvento dell'intelligenza artificiale, stanno attraversando una trasformazione radicale che sta chiudendo le porte a nuovi lavoratori.

**I Numeri della Crisi:**

Secondo il World Economic Forum, il 40% delle aziende prevede di tagliare personale dove l'IA può automatizzare le attività, con quasi 50 milioni di posti di lavoro negli Stati Uniti che saranno impattati nei prossimi anni. Oltre la metà dei ruoli entry-level corre un serio rischio di scomparire.

#### Settore Tecnologico: Il Collasso delle Opportunità Junior

Il settore IT, tradizionalmente il più accessibile per giovani laureati, sta vivendo una crisi senza precedenti:

- **Crollo delle offerte di lavoro**: Negli USA gli annunci per sviluppatori software sono crollati al livello minimo degli ultimi cinque anni, con una flessione di circa -35% rispetto al 2020
- **Trend europeo**: Calo del 35-40% delle posizioni junior nel settore tech in vari paesi come Olanda e Germania
- **Tagli nelle assunzioni**: Grandi aziende tech come Microsoft, Meta, Amazon e Salesforce hanno congelato o ridotto drasticamente le assunzioni di giovani sviluppatori
- **Riduzione entry-level**: Tra il 2023 e il 2024 le società tecnologiche di punta hanno ridotto del 25% le assunzioni entry-level, assumendo al loro posto più professionisti esperti

**Il motivo?** Molte attività tradizionalmente affidate ai junior - test di software, analisi dati di base, scrittura di documentazione tecnica - vengono ora svolte da strumenti IA.

#### Settore Finanziario: Automazione di Massa

Il settore bancario e finanziario sta affrontando una rivoluzione ancora più drammatica:

- **Ruoli a rischio**: Il 54% dei ruoli nel settore bancario europeo e americano è altamente suscettibile di automazione
- **Comparti correlati**: Nel settore assicurativo il 46% dei posti è a forte rischio automazione, mentre nei mercati finanziari la percentuale è del 40%
- **Perdita di opportunità formative**: Compiti come compilare fogli Excel, preparare modelli di valutazione o redigere slide di presentazione - un tempo affidati ad analisti junior - tendono ad essere automatizzati

**Un segnale preoccupante**: OpenAI ha reclutato oltre 100 ex banchieri d'investimento da Goldman Sachs, JP Morgan, Morgan Stanley e altre istituzioni per istruire l'intelligenza artificiale a svolgere compiti tipici dei ruoli entry-level in finanza. L'industria si sta attivamente preparando a sostituire il lavoro dei junior.

#### Altri Settori Colpiti

**Marketing e Commerciale:**
Nel confronto 2025 vs 2020, gli annunci nel settore marketing sono diminuiti del 19%, a fronte di un calo del 8% nelle vendite generali.

**Servizi Legali e Consulenza:**
Gli studi legali stanno tagliando posizioni di paralegali e le società di consulenza restringono i piani di formazione degli analisti junior.

**Altri Profili Vulnerabili:**
I profili junior più colpiti sono quelli che svolgono compiti ripetitivi o di supporto, tra cui contabili, revisori, sviluppatori software entry-level, addetti al customer service e receptionist.

#### La Dimensione del Fenomeno: Dati Globali

**Conferme dal campo:**
- Un'indagine internazionale su manager di UK, USA, Francia, Germania e altri paesi rileva che circa il 39% delle aziende ha già ridotto o eliminato posizioni entry-level grazie all'IA
- Il 41% dei responsabili dichiara esplicitamente che l'adozione dell'IA consente di tagliare il personale in organico

**Previsioni per il futuro:**
Il CEO di Anthropic Dario Amodei stima che l'IA potrebbe eliminare metà dei ruoli entry-level, con un conseguente aumento della disoccupazione anche del 10-20% nei prossimi anni.

#### Le Conseguenze Sociali

L'IA potrebbe ridurre del 50% i ruoli entry-level entro pochi anni, spingendo il tasso di disoccupazione su livelli mai visti dai tempi della crisi del debito sovrano (oltre il 10-12%). Molti giovani laureati troveranno sempre meno opportunità corrispondenti al loro titolo di studio e potrebbero vedersi costretti ad accettare ruoli con responsabilità ridotte o retribuzioni più basse.

**In questo contesto drammatico, trovare lavoro non è più solo difficile - è diventato una questione di sopravvivenza professionale che richiede strategie completamente nuove.**

---

### L'Inefficacia delle Strategie Tradizionali

In un mercato dove le opportunità si sono ridotte drasticamente, le strategie convenzionali di ricerca del lavoro sono diventate ancora più inefficaci.

#### Candidature su LinkedIn e Piattaforme Affini

Con la riduzione del 35-40% delle posizioni disponibili, candidarsi su LinkedIn è diventato un esercizio di frustrazione:

- **Tasso di feedback medio**: 10-20% (in calo costante)
- **Esito per profili non eccellenti**: prevalentemente negativo, impedendo persino di ottenere un colloquio
- **Causa principale**: per aziende di livello, ogni posizione riceve migliaia o decine di migliaia di candidature. Con meno posti disponibili e lo stesso (o maggiore) numero di candidati disperati, la competizione è diventata praticamente imbattibile tranne che per pochissimi profili d'élite
- **Il paradosso dell'IA**: mentre l'IA riduce i posti disponibili, i candidati usano strumenti IA per candidarsi a più posizioni, aumentando ulteriormente la competizione e rendendo tutto più omologato

#### Candidature sui Siti Aziendali

Candidarsi direttamente attraverso le pagine career aziendali è già una strategia migliore:

- **Vantaggio**: minor numero di candidati disposti a impiegare tempo e sforzo extra
- **Limite**: con il crollo delle assunzioni junior del 25-35% negli ultimi anni, il numero di candidature per ogni posizione rimasta è esploso
- **Risultato**: tasso di successo ancora molto basso, specialmente per profili senza esperienza che competono per i pochi ruoli entry-level sopravvissuti all'automazione

---

### La Strategia Vincente (ma Impraticabile)

#### Contatto Diretto con i Recruiter

In un mercato dove il 39% delle aziende ha già eliminato posizioni entry-level e la competizione per i ruoli rimasti è feroce, il contatto personale diretto con i recruiter non è più solo la strategia più efficace - **è l'unica che funziona davvero** perché:

- **Zero concorrenza**: punto di contatto diretto senza competizione con migliaia di altri candidati disperati
- **Visibilità garantita**: la mail viene letta direttamente dalla persona che conta
- **Possibilità di differenziarsi**: puoi sottolineare i tuoi punti di forza in modo personalizzato, cruciale quando le tue mansioni potrebbero essere svolte da un'IA
- **Bypassare l'automazione**: molte aziende usano sistemi ATS (Applicant Tracking Systems) potenziati da IA per scremare automaticamente i CV. Il contatto diretto bypassa completamente questo filtro

#### Perché Nessuno lo Fa

Creare un'email efficace per questo scopo è un processo lungo e complesso che richiede:

1. **Personalizzazione estrema**: l'email deve sembrare genuinamente interessata solo a quella specifica azienda
2. **Ricerca del recruiter ottimale**: identificare il recruiter con più punti in comune possibili con il candidato per creare un link emotivo basato su esperienze condivise
3. **Reperimento dell'email**: trovare l'indirizzo email del recruiter, operazione estremamente difficile senza contatti diretti in azienda o strumenti a pagamento

**Tempo stimato per una singola email di qualità**: 1-2 ore

**Moltiplicato per decine di aziende**: processo assolutamente insostenibile

**Il paradosso**: proprio quando avremmo più bisogno di questa strategia (perché le altre non funzionano più), è diventata ancora più critica ma rimane impraticabile su scala.

---

### La Soluzione CandidAI

In un'era in cui esperti prevedono uno "shock" occupazionale senza precedenti e metà dei ruoli entry-level potrebbero sparire, la nostra piattaforma **automatizza completamente questo processo**, rendendo praticabile l'unica strategia che funziona ancora:

- **Tempo**: poche ore per decine di aziende anziché settimane
- **Qualità garantita**: le email generate hanno la struttura e le caratteristiche ottimali per superare la diffidenza dei recruiter sommersi da candidature automatizzate
- **Miglioramento continuo**: tracciando quali email ricevono risposta e quali no, miglioriamo costantemente le generazioni, imitando i pattern che funzionano meglio per i nostri utenti
- **Scalabilità**: ciò che prima era impossibile ora diventa routine
- **Vantaggio competitivo**: mentre il 40% delle aziende taglia personale e l'IA sostituisce i ruoli junior, tu utilizzi l'IA per ottenere proprio quei ruoli che stanno diventando sempre più scarsi e preziosi

**CandidAI non è solo uno strumento di produttività - è la tua risposta strategica a un mercato del lavoro che si sta chiudendo.**

---

## Registrazione e Accesso

Gli utenti possono creare un account attraverso due modalità:

- **Email e password**: registrazione tradizionale
- **Account Google**: accesso rapido tramite OAuth

---

## Processo di Onboarding

Il processo di onboarding è strutturato in fasi sequenziali che guidano l'utente nella configurazione completa del proprio profilo e delle preferenze di ricerca.

### 1. Scelta del Piano

L'utente seleziona uno dei quattro piani disponibili:

- **Free**: piano base gratuito
- **Base**: funzionalità intermedie
- **Pro**: funzionalità avanzate
- **Ultra**: accesso completo a tutte le funzionalità

Ogni piano differisce per:
- Numero massimo di aziende target selezionabili
- Accesso alle funzionalità di personalizzazione avanzate
- Disponibilità di informazioni aziendali dettagliate
- Numero di criteri personalizzabili nella strategia di ricerca

### 2. Selezione delle Aziende Target

L'utente può aggiungere le aziende per cui desidera ottenere un colloquio attraverso:

- **Campo di testo con autocompletamento**: digitando il nome dell'azienda, il sistema suggerisce automaticamente i risultati
- **Limite di selezione**: determinato dal piano sottoscritto

Le aziende selezionate costituiranno il target per la generazione delle email personalizzate.

### 3. Inserimento delle Informazioni Personali

Questa fase è suddivisa in due step:

#### Step 3.1: Caricamento Dati Iniziali

L'utente fornisce:
- **URL del profilo LinkedIn**
- **Curriculum Vitae** (file)

#### Step 3.2: Compilazione Automatica e Modifica

Il sistema elabora automaticamente le informazioni da LinkedIn e dal CV, compilando i seguenti campi:

- Nome e cognome
- Nazionalità
- Job title attuale
- CV completo
- Skills chiave
- Lista delle esperienze lavorative
- Lista delle esperienze universitarie/formative
- Lista dei progetti
- Lista delle certificazioni

**Tutte le informazioni sono completamente modificabili**: l'utente può aggiungere, modificare o eliminare qualsiasi elemento per garantire la massima precisione del proprio profilo.

### 4. Personalizzazione della Strategia di Ricerca Recruiter

*Disponibile solo per i piani che lo prevedono.*

#### Come Funziona la Strategia

La strategia di ricerca dei recruiter si basa su una **scala gerarchica di criteri**. Ogni criterio è composto da una o più condizioni che il recruiter deve soddisfare.

**Esempi di condizioni:**
- Ha frequentato una specifica università
- Ha lavorato in una determinata azienda
- La sua job title include un termine specifico
- Si trova attualmente nel paese dell'utente
- Ha almeno livello senior

#### Processo di Ricerca

Il sistema applica i criteri in ordine gerarchico:

1. **Primo criterio** (il più stringente): il sistema cerca un recruiter che soddisfi tutte le condizioni
   - Se trova almeno un recruiter → viene selezionato il migliore
   - Se non trova nessuno → passa al criterio successivo

2. **Criteri successivi**: procedura identica con condizioni progressivamente meno restrittive

3. **Fallback #1 - Ricerca Owner/Founder**: se nessun recruiter viene trovato con tutti i criteri, il sistema ripete l'intera strategia cercando owner o founder dell'azienda

4. **Fallback #2 - Ricerca Figure Senior**: se non vengono trovati owner/founder, il sistema cerca qualsiasi figura senior in azienda, sempre seguendo la gerarchia dei criteri

#### Strategia di Default

Se l'utente non personalizza la strategia, viene applicata una configurazione generata automaticamente dalle sue informazioni:

**Criterio 1** (più stringente):
- Almeno una università in comune con l'utente
- Almeno una azienda precedente in comune
- Almeno una skill in comune
- Attualmente nel paese dell'utente
- Livello almeno senior

**Criteri successivi**: generati alternando e rilassando progressivamente queste condizioni.

#### Personalizzazione Disponibile

Gli utenti con piani idonei possono:
- **Aggiungere** nuovi criteri (fino al massimo consentito dal piano)
- **Duplicare** criteri esistenti per creare varianti
- **Eliminare** criteri non desiderati
- **Modificare** ogni criterio aggiungendo, modificando o eliminando condizioni specifiche
- **Riordinare** i criteri per cambiare la priorità di applicazione

Se il piano non prevede questa funzionalità, viene utilizzata automaticamente la strategia di default.

### 5. Definizione della Job Position e Istruzioni Custom

L'utente specifica:

- **Job position target**: la posizione lavorativa per cui si candida
- **Istruzioni custom** (opzionale): indicazioni personalizzate per influenzare la generazione delle email
  - Tono desiderato
  - Punti specifici da enfatizzare
  - Elementi da includere o evitare
  - Qualsiasi altra preferenza comunicativa

### 6. Pagamento

Completamento del pagamento per il piano selezionato.

---

## Dashboard e Raccolta Informazioni Aziendali

### Piani con Raccolta Dati Avanzata

Per i piani che lo prevedono, dopo il completamento dell'onboarding:

1. **Raccolta automatica**: il sistema raccoglie informazioni dettagliate per tutte le aziende target selezionate
2. **Visualizzazione nella dashboard**: le informazioni vengono presentate all'utente per verifica

#### Azioni Disponibili nella Dashboard

##### Correzione Aziende Errate

Se un'azienda visualizzata non corrisponde a quella desiderata, l'utente può:

1. Indicare quali aziende sono errate
2. Per ogni azienda da correggere, fornire:
   - Nome corretto dell'azienda
   - Dominio web
   - URL della pagina LinkedIn aziendale
3. **Costo**: pagamento di crediti per ogni azienda da ricercare nuovamente

##### Conferma e Personalizzazione Aziende

Dopo aver verificato che le aziende siano corrette, l'utente può:

1. **Confermare** le aziende selezionate
2. **Personalizzare la strategia per singola azienda** (opzionale):
   - Creare una strategia di ricerca recruiter specifica per quell'azienda
   - Rendere la ricerca ultra-mirata per contesti particolari
3. **Personalizzare le istruzioni custom per singola azienda** (opzionale):
   - Aggiungere istruzioni specifiche per la generazione dell'email per quella azienda
   - Ottenere granularità massima nella personalizzazione

### Piani Senza Raccolta Dati Avanzata

Per i piani che non includono questa funzionalità:

- **Conferma automatica**: tutte le aziende vengono confermate di default
- **Informazioni limitate**: non vengono raccolte informazioni aziendali dettagliate
- **Contesto ridotto**: le email generate avranno meno informazioni di contesto sull'azienda
- **Personalizzazione posticipata**: la personalizzazione della strategia o delle istruzioni custom per singola azienda può essere effettuata successivamente alla generazione, pagando crediti per ogni modifica

---

## Generazione delle Email

Una volta confermate tutte le aziende, inizia il processo automatico di generazione delle email.

### Fasi della Generazione

Per ogni azienda target, il sistema esegue le seguenti operazioni:

#### Fase 1: Ricerca del Recruiter

Il sistema applica la strategia di ricerca per identificare il recruiter ottimale:
- Utilizza la **strategia personalizzata per l'azienda** specifica (se configurata)
- Altrimenti utilizza la **strategia generale** dell'utente
- Segue il processo gerarchico con fallback su owner/founder e figure senior

#### Fase 2: Ricerca e Analisi degli Articoli Aziendali

Il sistema:

1. **Individua i blog aziendali** dell'azienda target
2. **Esplora gli articoli** pubblicati
3. **Seleziona i 3 articoli più rilevanti** in base a:
   - Job position indicata dall'utente
   - Profilo professionale dell'utente
4. **Estrae il contenuto completo** degli articoli selezionati

#### Fase 3: Generazione della Email Personalizzata

Il sistema utilizza l'intelligenza artificiale per generare un'email che integra:

- **Informazioni aziendali dettagliate** (se disponibili dal piano)
- **CV completo del candidato**
- **Profilo professionale dell'utente** (esperienze, formazione, progetti, certificazioni)
- **Contenuto degli articoli aziendali** più rilevanti
- **Profilo del recruiter selezionato**
- **Istruzioni custom** (generali e/o specifiche per l'azienda)

### Visualizzazione dello Stato di Avanzamento

Durante tutto il processo, la dashboard mostra in tempo reale:

- **Step corrente** per ogni azienda
- **Risultati ottenuti** progressivamente:
  - Articoli trovati
  - Profilo del recruiter selezionato
  - Stato della generazione

### Risultati Finali

Al termine del processo, per ogni azienda vengono visualizzati:

- **Email generata** completa
- **Profilo del recruiter** selezionato
- **Articoli scelti** dal blog aziendale
- **Informazioni dettagliate dell'azienda** (se disponibili)

---

## Invio delle Email

### Invio Singolo

Per ogni email generata, l'utente può:

1. **Aprire il client di posta**: cliccando sul pulsante di invio
   - **Oggetto**: precompilato
   - **Corpo**: testo dell'email generata
   - **Destinatario**: email del recruiter
   
2. **Completare manualmente**:
   - Impostare i campi del mittente
   - Allegare il proprio CV (manualmente o tramite drag-and-drop dal CV mostrato nella piattaforma, se il browser lo supporta)

3. **Inviare l'email** dal proprio client

4. **Confermare l'invio**: premere il pulsante "Sent" sulla piattaforma per registrare l'invio

### Invio in Blocco

Una volta generate tutte le email, è possibile inviarle automaticamente in blocco:

- **Metodo di invio**: varia in base al sistema operativo dell'utente
- **Personalizzazione**: l'utente può scegliere il metodo preferito

---

## Funzionalità Aggiuntive Post-Generazione

### Rigenerazione Email

Se l'email generata non soddisfa l'utente, può:

- **Rigenerare l'email** per quella specifica azienda
- **Costo**: pagamento in crediti
- **Personalizzazione**: aggiunta di istruzioni custom specifiche solo per quella rigenerazione

### Cambio Recruiter

Se il recruiter selezionato non è soddisfacente:

1. **Richiesta nuovo recruiter**: pagamento in crediti
2. **Personalizzazione strategia** (opzionale): specificare una strategia personalizzata solo per quell'azienda
3. **Esclusione automatica**: il recruiter precedente viene escluso dalle future ricerche per quella azienda
4. Il sistema applica nuovamente la strategia (personalizzata o generale) per trovare un recruiter diverso

### Esportazione del Prompt

Per utenti avanzati che vogliono massimo controllo:

- **Ottenere il prompt completo** utilizzato per la generazione dell'email
- **Costo**: pagamento in crediti
- **Utilizzo**: personalizzare ulteriormente il prompt o utilizzarlo con altri LLM esterni

---

## Follow-Up Automatizzato

*Funzionalità in fase di sviluppo*

La piattaforma includerà presto una sezione dedicata al follow-up delle email inviate senza risposta.

### Caratteristiche del Sistema di Follow-Up

- **Analisi statistica**: identificazione dei momenti ottimali per l'invio delle email di follow-up
- **Personalizzazione avanzata**: le email di follow-up saranno personalizzate considerando:
  - Profilo dell'utente
  - Profilo del recruiter
  - Contenuto dell'email originale
  - Contesto aziendale
- **Suggerimenti intelligenti**: raccomandazioni basate su dati statistici per massimizzare il tasso di risposta
- **Automatizzazione**: possibilità di programmare l'invio automatico nei momenti suggeriti

---

## Sistema di Crediti

La piattaforma utilizza un sistema di crediti per le funzionalità premium e le personalizzazioni avanzate:

### Operazioni che Richiedono Crediti

- Ricerca corretta di aziende errate
- Rigenerazione di email per aziende specifiche
- Ricerca di un nuovo recruiter per un'azienda
- Personalizzazione posticipata della strategia (per piani base)
- Personalizzazione posticipata delle istruzioni custom (per piani base)
- Esportazione del prompt completo di generazione

I crediti possono essere acquistati separatamente o sono inclusi in determinati piani.

---

## Vantaggi Chiave della Piattaforma

1. **Personalizzazione Estrema**: ogni email è unica e adattata al recruiter, all'azienda e al profilo del candidato

2. **Ricerca Intelligente dei Recruiter**: strategia gerarchica con fallback multipli per garantire sempre un contatto rilevante

3. **Contestualizzazione Aziendale**: utilizzo di articoli del blog aziendale per dimostrare interesse e preparazione

4. **Flessibilità**: possibilità di personalizzare ogni aspetto del processo, dall'onboarding alla singola email

5. **Efficienza**: automazione dell'intero processo di ricerca, analisi e generazione, risparmiando ore di lavoro manuale

6. **Controllo Totale**: l'utente mantiene il controllo finale su ogni email prima dell'invio

---

## Workflow Completo: Sintesi

\`\`\`
Registrazione → Scelta Piano → Selezione Aziende → Caricamento Profilo
                                                    ↓
                                        Personalizzazione Strategia
                                                    ↓
                                        Job Position + Istruzioni
                                                    ↓
                                                Pagamento
                                                    ↓
                    Raccolta Info Aziendali (se previsto dal piano)
                                                    ↓
                            Conferma/Correzione Aziende
                                                    ↓
            Personalizzazione per Azienda (strategia + istruzioni)
                                                    ↓
                                    Generazione Automatica:
                        1. Ricerca Recruiter per ogni azienda
                        2. Ricerca e analisi articoli aziendali
                        3. Generazione email personalizzata
                                                    ↓
                            Revisione Risultati in Dashboard
                                                    ↓
                    Opzioni: Rigenerare / Cambiare Recruiter / Esportare Prompt
                                                    ↓
                            Invio Email (singolo o blocco)
                                                    ↓
                            Conferma Invio sulla Piattaforma
                                                    ↓
                        Follow-Up Intelligente (in arrivo)
\`\`\`

---

## Conclusione

CandidAI rappresenta una soluzione completa per chi cerca lavoro, trasformando un processo tradizionalmente laborioso e generico in un'esperienza automatizzata, personalizzata e strategica. Grazie all'intelligenza artificiale e alla flessibilità di personalizzazione, gli utenti possono massimizzare le proprie possibilità di ottenere colloqui nelle aziende desiderate, presentandosi nel modo più efficace e professionale possibile.
        `,
        en: `# CandidAI - Complete Platform Documentation

## Overview
**CandidAI** is an innovative platform designed to help professionals get job interviews at target companies through artificial intelligence. The system generates personalized emails addressed to the most relevant recruiters, strategically selected based on the user's profile.

### Primary Goal
Facilitate direct contact with recruiters at desired companies through highly personalized emails, significantly increasing the chances of getting an interview.

---

## The Problem We Solve

### The Modern Labor Market Crisis

#### The Devastating Impact of AI on Junior Profiles

Sectors that just a few years ago were extremely flourishing and full of opportunities even for junior figures - such as IT and finance - are now undergoing a radical transformation with the advent of artificial intelligence, closing the doors to new workers.

**The Numbers of the Crisis:**

According to the World Economic Forum, 40% of companies plan to cut staff where AI can automate tasks, with nearly 50 million jobs in the United States being impacted in the coming years. Over half of entry-level roles are at serious risk of disappearing.

#### Technology Sector: The Collapse of Junior Opportunities

The IT sector, traditionally the most accessible for young graduates, is experiencing an unprecedented crisis:

- **Collapse in job postings**: In the US, job postings for software developers have plummeted to the lowest level in five years, with a decline of about -35% compared to 2020
- **European trend**: 35-40% drop in junior positions in the tech sector in various countries like the Netherlands and Germany
- **Hiring freezes**: Large tech companies like Microsoft, Meta, Amazon, and Salesforce have frozen or drastically reduced hiring of young developers
- **Reduction in entry-level**: Between 2023 and 2024, leading technology companies reduced entry-level hiring by 25%, hiring more experienced professionals instead

**The reason?** Many tasks traditionally assigned to juniors - software testing, basic data analysis, writing technical documentation - are now performed by AI tools.

#### Finance Sector: Mass Automation

The banking and finance sector is facing an even more dramatic revolution:

- **Roles at risk**: 54% of roles in the European and American banking sector are highly susceptible to automation
- **Related sectors**: In the insurance sector, 46% of jobs are at high risk of automation, while in financial markets the percentage is 40%
- **Loss of training opportunities**: Tasks like filling out Excel sheets, preparing valuation models, or drafting presentation slides - once assigned to junior analysts - tend to be automated

**A worrying sign**: OpenAI recruited over 100 former investment bankers from Goldman Sachs, JP Morgan, Morgan Stanley, and other institutions to train artificial intelligence to perform tasks typical of entry-level roles in finance. The industry is actively preparing to replace junior work.

#### Other Affected Sectors

**Marketing and Sales:**
In the 2025 vs. 2020 comparison, job postings in the marketing sector decreased by 19%, compared to an 8% decline in general sales.

**Legal Services and Consulting:**
Law firms are cutting paralegal positions and consulting firms are restricting training plans for junior analysts.

**Other Vulnerable Profiles:**
The most affected junior profiles are those performing repetitive or support tasks, including accountants, auditors, entry-level software developers, customer service representatives, and receptionists.

#### The Scale of the Phenomenon: Global Data

**Field confirmations:**
- An international survey of managers in the UK, USA, France, Germany, and other countries reveals that about 39% of companies have already reduced or eliminated entry-level positions thanks to AI
- 41% of managers explicitly state that AI adoption allows them to cut staff

**Future predictions:**
Anthropic CEO Dario Amodei estimates that AI could eliminate half of entry-level roles, potentially increasing unemployment by 10-20% in the coming years.

#### The Social Consequences

AI could reduce entry-level roles by 50% within a few years, pushing the unemployment rate to levels not seen since the sovereign debt crisis (over 10-12%). Many young graduates will find fewer and fewer opportunities matching their degrees and might be forced to accept roles with reduced responsibilities or lower salaries.

**In this dramatic context, finding a job is no longer just difficult - it has become a matter of professional survival that requires completely new strategies.**

---

### The Ineffectiveness of Traditional Strategies

In a market where opportunities have drastically reduced, conventional job search strategies have become even more ineffective.

#### Applications on LinkedIn and Similar Platforms

With a 35-40% reduction in available positions, applying on LinkedIn has become an exercise in frustration:

- **Average feedback rate**: 10-20% (constantly declining)
- **Outcome for non-excellent profiles**: predominantly negative, preventing even getting an interview
- **Main cause**: for top companies, every position receives thousands or tens of thousands of applications. With fewer positions available and the same (or greater) number of desperate candidates, the competition has become practically unbeatable except for a very few elite profiles
- **The AI paradox**: while AI reduces available positions, candidates use AI tools to apply for more positions, further increasing competition and making everything more standardized

#### Applications on Company Websites

Applying directly through company career pages is already a better strategy:

- **Advantage**: fewer candidates willing to invest extra time and effort
- **Limit**: with the 25-35% collapse in junior hiring in recent years, the number of applications for each remaining position has exploded
- **Result**: still very low success rate, especially for profiles without experience competing for the few entry-level roles that survived automation

---

### The Winning (but Impractical) Strategy

#### Direct Contact with Recruiters

In a market where 39% of companies have already eliminated entry-level positions and competition for remaining roles is fierce, personal direct contact with recruiters is no longer just the most effective strategy - **it's the only one that really works** because:

- **Zero competition**: direct point of contact without competition from thousands of other desperate candidates
- **Guaranteed visibility**: the email is read directly by the person who matters
- **Possibility to differentiate**: you can highlight your strengths in a personalized way, crucial when your tasks could be performed by AI
- **Bypass automation**: many companies use ATS (Applicant Tracking Systems) powered by AI to automatically screen CVs. Direct contact completely bypasses this filter

#### Why Nobody Does It

Creating an effective email for this purpose is a long and complex process that requires:

1. **Extreme personalization**: the email must appear genuinely interested only in that specific company
2. **Research of the optimal recruiter**: identify the recruiter with the most possible common ground with the candidate to create an emotional link based on shared experiences
3. **Email retrieval**: find the recruiter's email address, an extremely difficult operation without direct contacts in the company or paid tools

**Estimated time for a single quality email**: 1-2 hours

**Multiplied by dozens of companies**: absolutely unsustainable process

**The paradox**: just when we need this strategy the most (because the others no longer work), it has become even more critical but remains impractical at scale.

---

### The CandidAI Solution

In an era where experts predict an unprecedented employment "shock" and half of entry-level roles could disappear, our platform **completely automates this process**, making the only strategy that still works practical:

- **Time**: a few hours for dozens of companies instead of weeks
- **Guaranteed quality**: the generated emails have the optimal structure and characteristics to overcome recruiters' skepticism, who are inundated with automated applications
- **Continuous improvement**: by tracking which emails receive responses and which don't, we constantly improve generations, imitating the patterns that work best for our users
- **Scalability**: what was once impossible now becomes routine
- **Competitive advantage**: while 40% of companies cut staff and AI replaces junior roles, you use AI to obtain precisely those roles that are becoming increasingly scarce and valuable

**CandidAI is not just a productivity tool - it's your strategic response to a closing job market.**

---

## Registration and Login

Users can create an account through two methods:

- **Email and password**: traditional registration
- **Google account**: quick login via OAuth

---

## Onboarding Process

The onboarding process is structured in sequential phases that guide the user in the complete configuration of their profile and search preferences.

### 1. Plan Selection

The user selects one of the four available plans:

- **Free**: basic free plan
- **Base**: intermediate features
- **Pro**: advanced features
- **Ultra**: complete access to all features

Each plan differs in:
- Maximum number of selectable target companies
- Access to advanced customization features
- Availability of detailed company information
- Number of customizable criteria in the search strategy

### 2. Target Company Selection

The user can add the companies they want to get interviews for through:

- **Autocomplete text field**: typing the company name, the system automatically suggests results
- **Selection limit**: determined by the subscribed plan

The selected companies will constitute the target for generating personalized emails.

### 3. Personal Information Input

This phase is divided into two steps:

#### Step 3.1: Initial Data Upload

The user provides:
- **LinkedIn profile URL**
- **Curriculum Vitae** (file)

#### Step 3.2: Automatic Completion and Editing

The system automatically processes information from LinkedIn and the CV, filling in the following fields:

- First and last name
- Nationality
- Current job title
- Complete CV
- Key skills
- List of work experiences
- List of university/educational experiences
- List of projects
- List of certifications

**All information is completely editable**: the user can add, modify, or delete any element to ensure maximum accuracy of their profile.

### 4. Recruiter Search Strategy Personalization

*Available only for plans that include it.*

#### How the Strategy Works

The recruiter search strategy is based on a **hierarchical scale of criteria**. Each criterion consists of one or more conditions that the recruiter must satisfy.

**Examples of conditions:**
- Attended a specific university
- Worked at a particular company
- Their job title includes a specific term
- Currently located in the user's country
- Has at least senior level

#### Search Process

The system applies criteria in hierarchical order:

1. **First criterion** (the most stringent): the system looks for a recruiter who satisfies all conditions
   - If it finds at least one recruiter → the best one is selected
   - If it finds no one → moves to the next criterion

2. **Subsequent criteria**: identical procedure with progressively less restrictive conditions

3. **Fallback #1 - Owner/Founder Search**: if no recruiter is found with all criteria, the system repeats the entire strategy searching for company owners or founders

4. **Fallback #2 - Senior Figures Search**: if no owners/founders are found, the system searches for any senior figure in the company, always following the criteria hierarchy

#### Default Strategy

If the user doesn't personalize the strategy, an automatic configuration generated from their information is applied:

**Criterion 1** (most stringent):
- At least one university in common with the user
- At least one previous company in common
- At least one skill in common
- Currently in the user's country
- At least senior level

**Subsequent criteria**: generated by alternating and progressively relaxing these conditions.

#### Available Personalization

Users with eligible plans can:
- **Add** new criteria (up to the maximum allowed by the plan)
- **Duplicate** existing criteria to create variants
- **Delete** unwanted criteria
- **Modify** each criterion by adding, modifying, or deleting specific conditions
- **Reorder** criteria to change application priority

If the plan doesn't include this functionality, the default strategy is automatically used.

### 5. Job Position Definition and Custom Instructions

The user specifies:

- **Target job position**: the job position they're applying for
- **Custom instructions** (optional): personalized directions to influence email generation
  - Desired tone
  - Specific points to emphasize
  - Elements to include or avoid
  - Any other communication preference

### 6. Payment

Completion of payment for the selected plan.

---

## Dashboard and Company Information Collection

### Plans with Advanced Data Collection

For plans that include it, after onboarding completion:

1. **Automatic collection**: the system collects detailed information for all selected target companies
2. **Dashboard display**: information is presented to the user for verification

#### Actions Available in the Dashboard

##### Correction of Incorrect Companies

If a displayed company doesn't match the desired one, the user can:

1. Indicate which companies are incorrect
2. For each company to correct, provide:
   - Correct company name
   - Web domain
   - Company LinkedIn page URL
3. **Cost**: payment of credits for each company to be researched again

##### Company Confirmation and Personalization

After verifying that the companies are correct, the user can:

1. **Confirm** the selected companies
2. **Personalize strategy per company** (optional):
   - Create a specific recruiter search strategy for that company
   - Make the search ultra-targeted for particular contexts
3. **Personalize custom instructions per company** (optional):
   - Add specific instructions for email generation for that company
   - Obtain maximum granularity in personalization

### Plans Without Advanced Data Collection

For plans that don't include this functionality:

- **Automatic confirmation**: all companies are confirmed by default
- **Limited information**: detailed company information is not collected
- **Reduced context**: generated emails will have less company context information
- **Postponed personalization**: personalization of strategy or custom instructions per company can be done after generation, paying credits for each modification

---

## Email Generation

Once all companies are confirmed, the automatic email generation process begins.

### Generation Phases

For each target company, the system performs the following operations:

#### Phase 1: Recruiter Search

The system applies the search strategy to identify the optimal recruiter:
- Uses the **personalized strategy for the specific company** (if configured)
- Otherwise uses the user's **general strategy**
- Follows the hierarchical process with fallback on owner/founder and senior figures

#### Phase 2: Company Article Search and Analysis

The system:

1. **Identifies the company blogs** of the target company
2. **Explores the published articles**
3. **Selects the 3 most relevant articles** based on:
   - Job position indicated by the user
   - User's professional profile
4. **Extracts the complete content** of the selected articles

#### Phase 3: Personalized Email Generation

The system uses artificial intelligence to generate an email that integrates:

- **Detailed company information** (if available from the plan)
- **Candidate's complete CV**
- **User's professional profile** (experiences, education, projects, certifications)
- **Content of the most relevant company articles**
- **Profile of the selected recruiter**
- **Custom instructions** (general and/or specific to the company)

### Progress Status Display

During the entire process, the dashboard shows in real time:

- **Current step** for each company
- **Results obtained** progressively:
  - Articles found
  - Profile of the selected recruiter
  - Generation status

### Final Results

At the end of the process, for each company the following are displayed:

- **Complete generated email**
- **Profile of the selected recruiter**
- **Articles chosen** from the company blog
- **Detailed company information** (if available)

---

## Email Sending

### Single Sending

For each generated email, the user can:

1. **Open the email client**: by clicking the send button
   - **Subject**: pre-filled
   - **Body**: generated email text
   - **Recipient**: recruiter's email
   
2. **Complete manually**:
   - Set the sender fields
   - Attach their CV (manually or via drag-and-drop from the CV shown in the platform, if the browser supports it)

3. **Send the email** from their client

4. **Confirm sending**: press the "Sent" button on the platform to register the sending

### Bulk Sending

Once all emails are generated, it's possible to send them automatically in bulk:

- **Sending method**: varies based on the user's operating system
- **Personalization**: the user can choose their preferred method

---

## Additional Features Post-Generation

### Email Regeneration

If the generated email doesn't satisfy the user, they can:

- **Regenerate the email** for that specific company
- **Cost**: payment in credits
- **Personalization**: addition of custom instructions specific only to that regeneration

### Recruiter Change

If the selected recruiter isn't satisfactory:

1. **Request new recruiter**: payment in credits
2. **Strategy personalization** (optional): specify a personalized strategy only for that company
3. **Automatic exclusion**: the previous recruiter is excluded from future searches for that company
4. The system reapplies the strategy (personalized or general) to find a different recruiter

### Prompt Export

For advanced users who want maximum control:

- **Obtain the complete prompt** used for email generation
- **Cost**: payment in credits
- **Usage**: further customize the prompt or use it with other external LLMs

---

## Automated Follow-Up

*Feature in development*

The platform will soon include a dedicated section for follow-up of sent emails that received no response.

### Follow-Up System Characteristics

- **Statistical analysis**: identification of optimal times for sending follow-up emails
- **Advanced personalization**: follow-up emails will be personalized considering:
  - User profile
  - Recruiter profile
  - Original email content
  - Company context
- **Intelligent suggestions**: recommendations based on statistical data to maximize response rate
- **Automation**: possibility to schedule automatic sending at suggested times

---

## Credit System

The platform uses a credit system for premium features and advanced customizations:

### Operations Requiring Credits

- Correct research of incorrect companies
- Regeneration of emails for specific companies
- Search for a new recruiter for a company
- Postponed strategy personalization (for base plans)
- Postponed custom instructions personalization (for base plans)
- Export of the complete generation prompt

Credits can be purchased separately or are included in certain plans.

---

## Key Platform Advantages

1. **Extreme Personalization**: each email is unique and adapted to the recruiter, company, and candidate profile

2. **Intelligent Recruiter Search**: hierarchical strategy with multiple fallbacks to always guarantee a relevant contact

3. **Company Contextualization**: use of company blog articles to demonstrate interest and preparation

4. **Flexibility**: possibility to personalize every aspect of the process, from onboarding to the single email

5. **Efficiency**: automation of the entire search, analysis, and generation process, saving hours of manual work

6. **Total Control**: the user maintains final control over every email before sending

---

## Complete Workflow: Summary

\`\`\`
Registration → Plan Choice → Company Selection → Profile Upload
                                                    ↓
                                        Strategy Personalization
                                                    ↓
                                        Job Position + Instructions
                                                    ↓
                                                Payment
                                                    ↓
                    Company Info Collection (if included in plan)
                                                    ↓
                            Company Confirmation/Correction
                                                    ↓
            Per-Company Personalization (strategy + instructions)
                                                    ↓
                                    Automatic Generation:
                        1. Recruiter Search for each company
                        2. Search and analysis of company articles
                        3. Personalized email generation
                                                    ↓
                            Results Review in Dashboard
                                                    ↓
                    Options: Regenerate / Change Recruiter / Export Prompt
                                                    ↓
                            Email Sending (single or bulk)
                                                    ↓
                            Sending Confirmation on Platform
                                                    ↓
                        Intelligent Follow-Up (coming soon)
\`\`\`

---

## Conclusion

CandidAI represents a complete solution for job seekers, transforming a traditionally laborious and generic process into an automated, personalized, and strategic experience. Thanks to artificial intelligence and customization flexibility, users can maximize their chances of getting interviews at desired companies, presenting themselves in the most effective and professional way possible.`
    }

    return <div className="max-w-3xl mx-auto p-4">
        {/* Selettore lingua compatto */}
        <div className="flex justify-end mb-2">
            <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                <option value="en">EN</option>
                <option value="it">IT</option>
            </select>
        </div>

        {/* Contenuto Markdown */}
        <div className="prose prose-invert mx-auto">
            <ReactMarkdown>{content[lang]}</ReactMarkdown>
        </div>
    </div>
}

export default Page