# FretTrainer

Övningsapp för gitarrister som vill lära sig greppbrädan från mobilen. Tryck på
greppbrädan för att "spela" tonen – du hör den, ser tonnamnet och får feedback.

Ren HTML/CSS/JavaScript utan byggsteg eller beroenden. Allt ljud (gitarrton,
trummor, ackord, bas) syntetiseras i webbläsaren med Web Audio.

## Övningar

1. **Grundtoner på E & A** – en ton visas, hitta den på E- eller A-strängen
   (band 0–12) så nära din förra ton som möjligt. Rätt ton på en annan plats är
   inte fel, men appen visar vilket läge som låg närmare. Trumkomp i 120 bpm,
   0,5 s paus mellan tonerna, 1 minut, sedan poäng: rätt plats / rätt ton
   annan plats / fel.
2. **Ackordstoner** – fyra ackord går på repeat (ca 2 minuter) i en slumpad
   position om 6 band. Hitta tersen eller kvinten i varje ackord, var som helst
   i positionen. När du hittat tonen spelar du fritt tills nästa ackord.
   Välj Ters, Kvint eller Blandat (slumpas per ackord och ligger fast hela övningen).
3. **Grundtoner på E, A & D** – som övning 1, men med D-strängen också.

## Testa på telefonen

Datorn och telefonen ska vara på samma wifi.

```sh
git clone https://github.com/lutvek/frettrainer.git
cd frettrainer
python3 -m http.server 8000      # eller: npx serve
```

Ta reda på datorns IP-adress (`ipconfig getifaddr en0` på Mac, `ipconfig` på
Windows, `hostname -I` på Linux) och öppna `http://<datorns-ip>:8000` i
telefonens webbläsare. Välj "Lägg till på hemskärmen" för helskärm.

Hörs inget på iPhone? Kontrollera att ringsignalsreglaget inte står på tyst.

## Struktur

| Fil | Innehåll |
| --- | --- |
| `js/music.js` | Tonnamn, lägen på halsen, "närmaste läge", ackordföljder |
| `js/audio.js` | Ljudmotor (Karplus–Strong-gitarr, trummor, ackord, bas) och taktschemaläggare |
| `js/fretboard.js` | Greppbrädan som SVG – valfritt bandintervall (t.ex. 0–12, en position eller 0–20) och aktiva strängar |
| `js/ex1.js`, `js/ex2.js` | Övningarna |
| `js/app.js` | Meny, spelvy och resultat |

En ny övning är ett objekt med `id`, `title`, `desc`, `options` och
`start(env, opts)` som läggs till i listan i `js/app.js`.

## En enda fil

`tools/build-single.sh` bygger hela appen till en fristående HTML-fil
(`dist/frettrainer.html`) som kan delas eller publiceras som en sida.
