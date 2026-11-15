# FretTrainer

Övningsapp för gitarrister som vill lära sig greppbrädan från mobilen. Tryck på
greppbrädan för att "spela" tonen – du hör den, ser tonnamnet och får feedback.

Ren HTML/CSS/JavaScript utan byggsteg eller beroenden. Allt ljud (gitarrton,
trummor, ackord, bas) syntetiseras i webbläsaren med Web Audio.

## Övningar

1. **Grundtoner på E & A** – en ton visas, hitta den på E- eller A-strängen
   (band 0–12) så nära din förra ton som möjligt. Rätt ton på en annan plats är
   inte fel, men appen visar vilket läge som låg närmare. Trumkomp i 120 bpm,
   nästa ton visas direkt, 1 minut, sedan poäng: rätt plats / rätt ton
   annan plats / fel.
2. **Ackordstoner** – fyra ackord går på repeat (ca 2 minuter) i en slumpad
   position om 6 band. Hitta tersen eller kvinten i varje ackord, var som helst
   i positionen. När du hittat tonen spelar du fritt tills nästa ackord.
   Välj Ters, Kvint eller Blandat (slumpas per ackord och ligger fast hela övningen).
3. **Grundtoner på E, A & D** – som övning 1, men med D-strängen också.
4. **Hitta alla** – en ton visas, tryck alla platser där den finns på alla sex
   strängar (band 0–12) innan takterna tar slut. 8 toner i trumkomp, 100 bpm.
   Med *Oktavhopp* tänds en starton på E- eller A-strängen och resten hittas
   utifrån den. Välj naturliga toner eller alla 12, och 4, 3 eller 2 takter per
   ton. Missade platser visas streckade. Poäng: hittade / missade platser, fel
   och kompletta toner.
5. **Triader på G, B & e** – en slumpad ackordföljd på 8 ackord (dur, moll och
   dim7) i en position om 5 band på de tre ljusaste strängarna. Följden bygger på
   funktionsharmonik (t.ex. I–vi–ii–V, dim7 som ledtonsackord som löser upp sig)
   och kan byta tonart via den nya tonartens V eller vii°7, och sista ackordet
   leder tillbaka till det första. Inräkningen (två takter) startar när du
   trycker *Redo*. 4 varv i 90 bpm, en takt per ackord. Spela ackordets alla tre
   toner (3 av 4 för dim7). Hinner du inte innan takten är slut pausas trummor
   och komp tills du hittat dem.

## Installera på iPhone (PWA)

Appen är en PWA: den kan läggas på hemskärmen, startar i helskärm och fungerar
utan nät. Ingen App Store eller utvecklarkonto behövs.

1. Publicera repot med GitHub Pages (en gång): *Settings → Pages → Build and
   deployment → Source: Deploy from a branch → Branch: `main`, mapp `/ (root)`*.
   Efter någon minut ligger appen på `https://lutvek.github.io/frettrainer/`.
   (Pages kräver publikt repo på gratisplanen. Alternativ: Netlify eller Cloudflare Pages.)
2. Öppna länken i **Safari** på iPhone → dela-knappen → **Lägg till på hemskärmen**.
3. Dela samma länk med vänner – de gör likadant.

Uppdateringar: pusha till `main`. Appen hämtar alltid senaste versionen när den
har nät (stäng och öppna den igen), och använder den senast sparade utan nät.

| Fil | Innehåll |
| --- | --- |
| `manifest.webmanifest` | Namn, ikoner, helskärmsläge |
| `sw.js` | Service worker – "nätet först", cache som reserv offline |
| `icons/` | Appikoner, ritas av `tools/make-icons.py` (Pillow) |

## Testa på telefonen (lokalt)

Datorn och telefonen ska vara på samma wifi.

```sh
git clone https://github.com/lutvek/frettrainer.git
cd frettrainer
python3 -m http.server 8000      # eller: npx serve
```

Ta reda på datorns IP-adress (`ipconfig getifaddr en0` på Mac, `ipconfig` på
Windows, `hostname -I` på Linux) och öppna `http://<datorns-ip>:8000` i
telefonens webbläsare. Välj "Lägg till på hemskärmen" för helskärm.

Hörs inget på iPhone? Appen ber om att få spela som media (hörs då även i tyst
läge, Safari 17+). Hörs ändå inget: kontrollera ringsignalsreglaget och volymen.

## Struktur

| Fil | Innehåll |
| --- | --- |
| `js/music.js` | Tonnamn, lägen på halsen, "närmaste läge", ackordföljder (även slumpade med dim och tonartsbyten) |
| `js/audio.js` | Ljudmotor (Karplus–Strong-gitarr, trummor, ackord, bas) och taktschemaläggare |
| `js/fretboard.js` | Greppbrädan som SVG – valfritt bandintervall (t.ex. 0–12, en position eller 0–20) och aktiva strängar |
| `js/ex1.js`, `js/ex2.js`, `js/ex4.js`, `js/ex5.js` | Övningarna (`ex1.js` innehåller både övning 1 och 3) |
| `js/app.js` | Meny, spelvy och resultat |

En ny övning är ett objekt med `id`, `title`, `desc`, `options` och
`start(env, opts)` som läggs till i listan i `js/app.js`.

## En enda fil

`tools/build-single.sh` bygger hela appen till en fristående HTML-fil
(`dist/frettrainer.html`) som kan delas eller publiceras som en sida.
