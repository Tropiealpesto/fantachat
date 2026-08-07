# FantaChat - matrice Sportmonks

Stato: bozza operativa.

Obiettivo: definire come importare e trasformare i dati Sportmonks dentro FantaChat senza cambiare la logica fantasy decisa per l'app.

Nota importante: in FantaChat il portiere non e il singolo calciatore. L'utente sceglie il portiere della squadra. Quindi i portieri Sportmonks reali non devono diventare opzioni fantasy selezionabili come `P`.

## Entita principali

| Area FantaChat | Origine Sportmonks | Destinazione FantaChat | Regola |
| --- | --- | --- | --- |
| Competizione | League | `competitions` | Una competizione FantaChat punta a una league Sportmonks. |
| Stagione | Season | `seasons` | La stagione Sportmonks corrente diventa la stagione attiva. |
| Squadra reale | Team | `real_teams` | Importare id, nome, short code, logo. |
| Giocatore reale | Squad player | `real_players` | Importare solo D/C/A dai giocatori reali. |
| Portiere fantasy | Team | `real_players` con ruolo `P` | Creare una riga fantasy per ogni squadra reale, non per ogni portiere reale. |
| Allenatore | Coach | `real_coaches` | Allenatore separato dai giocatori e dal limite top team. |
| Calendario | Schedule / Fixture | `fixtures`, `matchdays` | Le giornate FantaChat derivano dai round Sportmonks. |
| Statistiche giocatore | Fixture lineups details | `player_stats` | Aggregare per giocatore, competizione, stagione, giornata. |
| Statistiche portiere squadra | Fixture team/player stats | `player_stats` della riga `P` squadra | Calcolare sul team, non sul singolo portiere. |
| Statistiche allenatore | Fixture team stats + risultato | `coach_stats` | Calcolare per squadra reale e giornata. |
| Probabili formazioni | Fixture expectedLineups | `fixture_expected_lineups` | Importare titolari previsti e candidati quando Sportmonks li rende disponibili. |
| Foto giocatori | Player `image_path` | `real_players.image_url` | Usare nelle schermate statistiche/dettaglio, non obbligatorio in rosa se si preferiscono maglie. |
| Foto allenatori | Coach `image_path` | `real_coaches.image_url` | Usare in dettaglio allenatore o statistiche, non sul campo principale. |

## Competizioni e stagioni

| Competizione | Sportmonks league id | Stato accesso | Note |
| --- | ---: | --- | --- |
| Serie A | `384` | Accessibile | Stagione corrente trovata: `27895`, nome `2026/2027`. |
| Coppa Italia | `390` | Accessibile | Da importare come coppa quando serve. |
| Champions League | aperto | Non accessibile nel test | Sportmonks ha risposto con nessun risultato/accesso non disponibile. |

## Ruoli giocatori

| Sportmonks position | Sportmonks id visto | FantaChat role | Import fantasy |
| --- | ---: | --- | --- |
| Goalkeeper | `24` | `P` | No come singolo giocatore. Usare solo per eventuali dati di supporto. |
| Defender | `25` | `D` | Si. |
| Midfielder | `26` | `C` | Si. |
| Attacker | `27` | `A` | Si. |
| Coach | coach endpoint | `ALL` | Si, in `real_coaches`, non in `real_players`. |

## Regola portiere di squadra

| Punto | Decisione |
| --- | --- |
| Scelta utente | L'utente sceglie "Portiere Inter", "Portiere Milan", ecc. |
| Nome mostrato | Preferibile mostrare il nome squadra, es. `Inter`, non il nome del portiere reale. |
| Record DB | Una riga in `real_players` per ogni squadra con `role = 'P'` e `real_team_id` valorizzato. |
| Sportmonks id | Il riferimento principale deve essere il team Sportmonks, non il player Sportmonks. |
| Statistiche | Clean sheet, gol subiti e dati portiere vanno aggregati sulla squadra/giornata. |
| Vincolo top team | Il portiere conta come scelta della squadra, come gia deciso per i giocatori. |

## Regola allenatore

| Punto | Decisione |
| --- | --- |
| Scelta utente | Allenatore obbligatorio solo se la competizione abilita l'allenatore. |
| Record DB | `real_coaches`, collegato a `real_team_id`. |
| Nome mostrato | Nome allenatore + squadra. Il nome e importante. |
| Duplicabilita | Non duplicabile nella stessa lega/giornata. |
| Limite top team | Non rientra nel limite top 6. |
| Moltiplicatore | `1` se allenatore abilitato, `0` se non abilitato. |
| Import dati | Le statistiche allenatore possono esistere sempre, anche se il ruleset non le usa. |

## Ruleset competizione

| Opzione creazione lega | `scoring_ruleset` | `coach_enabled` | Descrizione |
| --- | --- | --- | --- |
| Classico | `classico` | `false` | Punteggi base senza allenatore. |
| Classico con allenatore | `classico` | `true` | Punteggi base + allenatore. |
| Da statisti | `non_standard` | `false` | Punteggi base + statistiche avanzate. |
| Da statisti con allenatore | `non_standard` | `true` | Formula completa. |

## Matrice punteggi giocatore

| Statistica FantaChat | Peso | Origine Sportmonks vista | Campo FantaChat | Stato |
| --- | ---: | --- | --- | --- |
| Gol segnato | `+3` | `Goals`, type id `52` | `goals` | Confermata |
| Assist | `+1` | `Assists`, type id `79` | `assists` | Confermata |
| Ammonizione | `-0.5` | `Yellowcards`, type id `84` | `yellow` | Confermata |
| Espulsione | `-1` | da evento/statistica rossi | `red` | Aperta: confermare nome/type id |
| Rigore sbagliato | `-3` | penalty missed | `pen_missed` | Aperta: confermare nome/type id |
| Rigore parato | `+3` | penalty saved | `pen_saved` | Aperta: confermare nome/type id |
| Passaggi riusciti | `+0.005` cad. | `Accurate Passes`, type id `116` | `passes_completed` | Confermata |
| Precisione passaggi | `+0.3` se >85% e almeno 20 riusciti | `Accurate Passes Percentage`, type id `1584` | `pass_accuracy` | Confermata |
| Tackle | `+0.10` cad. | `Tackles`, type id `78` | `tackles` | Confermata |
| Intercetto | `+0.10` cad. | `Interceptions`, type id `100` | `interceptions` | Confermata |
| xG / npxG | `x1` | `Expected Goals (xG)`, type id `5304`; npxG aperto | `xg`, `npxg` | xG confermata, npxG aperta |
| xA / expected assist | `x1` | expected assists | `xa` | Aperta: confermare nome/type id |
| Porta inviolata portiere | `+1` | derivata da gol subiti squadra = 0 | `clean_sheet` | Derivata |
| Porta inviolata difensore | `+1` | derivata da gol subiti squadra = 0 | `clean_sheet` | Derivata |
| Gol subito portiere | `-1` cad. | team/opponent goals; anche `Goalkeeper Goals Conceded`, type id `1535` | `goals_conceded` | Confermata/derivata |
| % parate portiere | `+0.5` se >80% | `Saves`, type id `57` + gol subiti | `save_pct` | Calcolabile |
| % parate rafforzato | `+1` se >80% e almeno 5 parate | `Saves`, type id `57` + gol subiti | `saves`, `save_pct` | Calcolabile |

## Matrice punteggi allenatore

| Statistica allenatore | Peso | Origine Sportmonks | Campo FantaChat | Stato |
| --- | ---: | --- | --- | --- |
| Vittoria | `+1` | risultato fixture / scores | `result = 'win'` | Derivata |
| Pareggio | `0` | risultato fixture / scores | `result = 'draw'` | Derivata |
| Sconfitta | `-1` | risultato fixture / scores | `result = 'loss'` | Derivata |
| npXG squadra | `x1` | statistica squadra da confermare | `npxg` | Aperta |
| Possesso palla >= 60% | `+0.5` | `Ball Possession %`, type id `45` | `possession` | Confermata |
| Tetto massimo positivo | `+3` max | calcolo FantaChat | funzione `compute_coach_points` | Confermata |

## Import calendario

| Sportmonks | FantaChat | Regola |
| --- | --- | --- |
| Schedule season | lista partite | Usare per creare/aggiornare fixture. |
| Round name | `matchdays.number` | Se il round e numerico, usarlo come giornata. |
| Fixture id | `fixtures.sportmonks_id` futuro | Serve per aggiornamenti live/finali. |
| Participants | squadre casa/trasferta | Collegare a `real_teams.sportmonks_id`. |
| Scores/state | stato e risultato | Usare per live, storico, coach result. |

## Import giocatori

| Step | Regola |
| --- | --- |
| 1 | Importare squadre reali della stagione. |
| 2 | Importare giocatori D/C/A dalle rose Sportmonks. |
| 3 | Creare un solo portiere fantasy per ogni squadra reale. |
| 4 | Importare allenatori attivi e collegarli alla squadra. |
| 5 | Non cancellare automaticamente giocatori non piu presenti: disattivarli, cosi lo storico resta stabile. |

## Import statistiche giornata

| Step | Regola |
| --- | --- |
| 1 | Leggere le fixture della giornata. |
| 2 | Per ogni fixture, leggere dettaglio con lineup, events, statistics, coaches. |
| 3 | Salvare statistiche D/C/A per player Sportmonks id. |
| 4 | Salvare statistiche `P` per team Sportmonks id. |
| 5 | Salvare statistiche allenatore per team Sportmonks id. |
| 6 | Eseguire ricalcolo FantaChat della giornata. |

## Import probabili formazioni

| Sportmonks | FantaChat | Regola |
| --- | --- | --- |
| `expectedLineups` | `fixture_expected_lineups` | Include dedicato sulle fixture future/vicine. |
| `type_id = 77614` | `lineup_status = 'starter'` | Probabile titolare. |
| `type_id = 77615` | `lineup_status = 'candidate'` | Candidato / alternativa. |
| `formation_field` | posizione campo | Utile per mostrare la probabile disposizione. |
| `formation_position` | ordinamento | Utile per ordinare gli undici. |
| `player_id` | `real_players.sportmonks_id` | Aggancio al giocatore FantaChat se importato. |
| `team_id` | `real_teams.sportmonks_id` | Aggancio alla squadra reale. |

Uso consigliato in app:

- in Rosa, mostrare un indicatore piccolo "probabile titolare" o "in dubbio";
- nel dettaglio giocatore, mostrare se e atteso titolare nella prossima partita;
- evitare che la probabile formazione diventi una regola vincolante: deve aiutare la scelta, non bloccarla;
- per il portiere FantaChat, continuare a ragionare sulla squadra, anche se Sportmonks mostra il nome del portiere previsto.

## Campi Sportmonks da confermare

Questi campi restano aperti perche vanno agganciati al nome/type id preciso che confermeremo con altri output Sportmonks o dalla documentazione del piano attivo.

| Dato | Decisione temporanea |
| --- | --- |
| Espulsione | Lasciare mapping aperto. |
| Rigore sbagliato | Lasciare mapping aperto. |
| Rigore parato | Lasciare mapping aperto. |
| xA | Lasciare mapping aperto. |
| npxG giocatore | Se non esiste, usare xG come fallback solo se deciso esplicitamente. |
| npxG squadra allenatore | Lasciare mapping aperto. |

## Prossima implementazione consigliata

1. Aggiungere colonne Sportmonks mancanti nelle tabelle FantaChat, se non gia presenti.
2. Creare script import Serie A: squadre, D/C/A, portieri fantasy di squadra, allenatori.
3. Creare script import calendario.
4. Creare script import statistiche giornata.
5. Creare sync probabili formazioni per le partite vicine.
6. Fare test su una giornata chiusa della stagione precedente.
