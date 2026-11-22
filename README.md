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
5. **Triader på G, B & e – i tonart** – en slumpad ackordföljd på 8 ackord ur en
   durskala (skalans dur- och mollackord och vii°), i en position om 5 band på de
   tre ljusaste strängarna. Varje ackord i följden går alltid att ta med en ton
   per sträng inom fönstret. Läget väljs efter tonarten: det fönster där flest av
   följdens ackord har en sluten form och där tonikan finns på G- eller
   B-strängen. Följden bygger på funktionsharmonik (t.ex. I–vi–ii–V), inget
   ackord kommer två gånger i rad och sista ackordet leder tillbaka till det
   första. Inräkningen (två takter) startar när du trycker *Redo* (mitt på
   greppbrädan). 4 varv i
   90 bpm, en takt per ackord. Spela ackordets alla tre toner. Med *Vänta på
   rätt toner* (standard) stannar musiken efter ackordets första slag tills du
   hittat dem, som i Ackordstoner; utan rullar den på och ackordet räknas som
   missat.
6. **Triader på G, B & e – slumpat läge** – svårare variant: helt slumpat läge
   (band 1–10, bland lägen där alla ackord går att ta en ton per sträng), dim7-ackord (3 av 4 toner räcker, dim7 som ledtonsackord som
   löser upp sig) och tonartsbyten via den nya tonartens V eller vii°7. Varje
   ackord förekommer bara en gång i följden. Samma val för *Vänta på rätt toner*.

7. **Vilken ton?** – omvänd riktning: en prick tänds på greppbrädan och du väljer
   tonnamnet på en knappsats under brädan innan tiden tar slut (ett försök per
   ton). 16 toner i trumkomp, 100 bpm; varje ton spelas när pricken tänds, och
   nästa kommer på en taktetta. Välj strängar (E & A eller alla sex), band
   (prickbanden 0, 3, 5, 7, 9, 12 eller alla 0–12), naturliga toner eller alla 12
   (förtecken med båda namnen) och 2 eller 1 takt per ton. På dator går det att
   svara med tangenterna C D E F G A B. Poäng: rätt / fel / för sent, mediantid
   för rätta svar och långsammaste sträng.
8. **Grundtoner på G, B & e** – som övning 1, men på de tre ljusa strängarna
   (G, B och e, band 0–12).
9. **Arpeggios i tonart** – samma upplägg som övning 5 (8 ackord ur en durskala,
   en takt per ackord i 90 bpm, *Redo*, inräkning och *Vänta på rätt toner*),
   men 2 varv och i en position om 5 band på alla sex strängar, där tonikan finns
   på E- eller A-strängen. Spela ackordet som arpeggio, en ton i taget:
   grundton, ters, kvint och grundtonen en oktav upp. Varje ton ska vara
   närmaste ackordston ovanför den förra, och grundtonen måste väljas så att
   arpeggiot får plats i läget. Välj *Uppåt* (1–3–5–1), *Nedåt* (1–5–3–1) eller
   *Växla* (upp och ner varannat ackord). Stegen visas i HUD:en och fylls i med
   tonnamn när de spelas. Poäng: klara arpeggios, feltryck och snittid (eller
   missade ackord).
10. **Intervall** – en starton (orange) tänds på greppbrädan och ett intervall
    visas, t.ex. ♭3↑ (liten ters upp). Hitta tonen i rätt oktav, på valfri sträng,
    innan tiden tar slut; måltonen går alltid att nå inom fyra band från startonen.
    Fel tryck förklaras (t.ex. "rätt ton men fel oktav" eller vilket intervall du
    tog), och missade intervall visas streckade. 16 intervall i trumkomp, 100 bpm.
    Välj Vanliga (terser, kvart, kvint, oktav) eller alla 12, Uppåt eller Upp & ned,
    och 2 eller 1 takt per intervall. Tonerna stavas efter intervallet (liten ters
    från C är E♭). Poäng: rätt / fel / för sent, mediantid och svåraste intervall.

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
| `js/ex1.js`, `js/ex2.js`, `js/ex4.js`, `js/ex5.js`, `js/ex7.js`, `js/ex9.js`, `js/ex10.js` | Övningarna (`ex1.js` innehåller övning 1, 3 och 8) |
| `js/app.js` | Meny, spelvy och resultat |

En ny övning är ett objekt med `id`, `title`, `desc`, `options` och
`start(env, opts)` som läggs till i listan i `js/app.js`.

## En enda fil

`tools/build-single.sh` bygger hela appen till en fristående HTML-fil
(`dist/frettrainer.html`) som kan delas eller publiceras som en sida.
