// Source for src/data/topics.json (Themen-Seiten /angebote/<slug>/). Run: node scripts/topics-src.mjs
// Fields: slug, kw (Suchbegriff im Titel), h (Überschrift), re (RegExp auf Titel+Marke), cat (optional), max (Preisgrenze), vegan,
// intro, tips (Kaufkriterien), best (Bestenliste), art (Ratgeber), group (für interne Verlinkung)
import fs from "node:fs";
const T = [];
const t = (slug, kw, h, re, o, intro, tips) => T.push({ slug, kw, h, re, ...o, intro, tips });

/* Haushalt */
t("saugroboter", "Saugroboter", "Saugroboter-Angebote", "Saugroboter|Saug- und Wisch|Roomba|DEEBOT", { group: "haushalt", best: "beste-saugroboter" },
  "Saugroboter gehören zu den Produkten mit den stärksten Preisschwankungen: Modelle vom Vorjahr werden oft deutlich günstiger, sobald der Nachfolger erscheint. Hier findest du alle aktuell geprüften Saugroboter-Deals von Roborock, Dreame, eufy, iRobot und Ecovacs.",
  ["Navigation: LiDAR-Laser oder Kamera-Navigation planen Räume sauber; Billigmodelle ohne Laser fahren chaotisch.", "Absaugstation lohnt sich, wenn du den Roboter wochenlang nicht anfassen willst. Mit Wischmopp-Waschstation (Omni/Ultra) wird es komfortabel, aber teurer.", "Saugkraft in Pascal (Pa) ist nur ein Richtwert. Wichtiger sind Bürstentyp (Gummi gegen Haare) und Teppicherkennung."]);
t("saug-wischroboter", "Saug- und Wischroboter", "Saug- und Wischroboter im Angebot", "Saug- und Wisch|Wischroboter|Omni|Roomba Combo", { group: "haushalt", best: "beste-saugroboter" },
  "Saug- und Wischroboter erledigen beides in einem Durchgang. Die besten Modelle heben den Mopp auf Teppich an und waschen ihn in der Station selbst aus. Hier siehst du alle aktuellen Deals mit Preisverlauf.",
  ["Mopp-Anhebung oder abnehmbarer Mopp verhindert nasse Teppiche.", "Stationen mit Heißwasser- oder Heißluft-Trocknung beugen Geruch vor.", "Achte auf Ersatzteilpreise (Beutel, Mopps, Filter): Sie bestimmen die laufenden Kosten."]);
t("akku-staubsauger", "Akku-Staubsauger", "Akku-Staubsauger-Angebote", "Akku-Staubsauger|Akku-Sauger|Akku-Handstaubsauger|WandVac|Bodenstaubsauger|V8|V10|V12", { group: "haushalt", best: "bester-akkustaubsauger" },
  "Akkusauger von Dyson, Shark, AEG und Philips sind regelmäßig stark reduziert, vor allem ältere Generationen. Wir zeigen nur Deals, deren Preis wir gegen den Verlauf geprüft haben.",
  ["Laufzeit in der Praxis gilt meist für die kleinste Stufe; plane mit einem Drittel davon im Turbo-Modus.", "Wechselakku ist ein großer Vorteil für größere Wohnungen.", "Für Tierhaare: Anti-Verhedder-Bürste und gute Filterung (HEPA) wählen."]);
t("nass-trocken-sauger", "Nass-Trocken-Sauger", "Wischsauger und Nass-Trocken-Sauger im Angebot", "Nass-Trocken|Wischsauger|Nassbodenreiniger|Wischmop|PencilWash|kabelloser elektrischer Wisch|Flecken", { group: "haushalt" },
  "Wischsauger saugen und wischen Hartböden in einem Zug und nehmen auch Flüssigkeiten auf. Hier findest du aktuelle Angebote von Roborock, Dyson, Shark und anderen.",
  ["Selbstreinigung und Trocknung der Walze verhindern Gerüche.", "Zwei Tanks (Frisch- und Schmutzwasser) sind Standard; größer heißt weniger Nachfüllen, aber schwerer.", "Für Teppiche sind Wischsauger nicht geeignet, dafür brauchst du zusätzlich einen normalen Sauger."]);
t("waschtrockner", "Waschtrockner", "Waschtrockner-Angebote", "Waschtrockner", { group: "haushalt", art: "waschmaschine-trockner-angebote" },
  "Ein Waschtrockner spart Platz, wenn für Waschmaschine und Trockner kein Raum ist. Hier siehst du alle geprüften Waschtrockner-Deals von Bosch, LG und anderen Herstellern.",
  ["Die Trocken-Kapazität ist meist nur gut halb so groß wie die Wasch-Kapazität.", "Modelle mit Wärmepumpe sind im Trocknen deutlich sparsamer als Kondensgeräte.", "Rechne die Energieeffizienz für Waschen und Trocknen getrennt."]);
t("waermepumpentrockner", "Wärmepumpentrockner", "Wärmepumpentrockner-Angebote", "Wärmepumpentrockner|Trockner", { group: "haushalt", not: "Waschtrockner|Haar", art: "waschmaschine-trockner-angebote" },
  "Wärmepumpentrockner kosten in der Anschaffung mehr, verbrauchen aber nur einen Bruchteil des Stroms von Ablufttrocknern. Hier findest du die aktuell besten Deals mit Preisverlauf.",
  ["Energieeffizienzklasse A+++ spart über die Jahre oft mehr, als der Aufpreis kostet.", "Selbstreinigender Kondensator spart lästiges Filterputzen.", "Für Familien: 8 bis 9 kg Fassungsvermögen."]);
t("kuehlschrank", "Kühlschrank", "Kühlschrank-Angebote", "Kühlschrank|Kühl-Gefrier|Side-by-Side|Multi-Door|Gefrierschrank", { group: "haushalt" },
  "Kühl-Gefrierkombinationen, Side-by-Side-Kühlschränke und Gefrierschränke gehören zu den Großgeräten mit den höchsten Ersparnissen in Euro. Wir prüfen jeden Deal gegen den Preisverlauf.",
  ["NoFrost spart das Abtauen, kostet aber etwas mehr Strom.", "Achte auf die Energieeffizienzklasse und den Jahresverbrauch in kWh, nicht nur auf den Kaufpreis.", "Maße und Türanschlag vor dem Kauf prüfen, besonders bei Einbaugeräten."]);
t("geschirrspueler", "Geschirrspüler", "Geschirrspüler-Angebote", "Geschirrspül|Spülmaschine|Einbau-Spülmaschi", { group: "kueche" },
  "Geschirrspüler von Bosch, Bauknecht und anderen gibt es oft deutlich unter UVP. Hier findest du freistehende, Unterbau- und Einbaugeräte mit geprüftem Preis.",
  ["Bauform zuerst klären: freistehend, unterbaufähig, teil- oder vollintegriert.", "Geräuschwert unter 44 dB ist für offene Küchen angenehm.", "Besteckschublade (dritte Ebene) bringt mehr Platz im Unterkorb."]);
t("kochfeld", "Induktionskochfeld", "Kochfeld-Angebote: Induktion und Glaskeramik", "Kochfeld", { group: "kueche" },
  "Induktionskochfelder kochen schneller und sparsamer als Glaskeramik. Hier siehst du alle aktuellen Kochfeld-Deals, geprüft gegen den Preisverlauf.",
  ["Induktion braucht magnetische Töpfe; prüfe dein Kochgeschirr mit einem Magneten.", "Flex-Zonen erlauben große Bräter und Grillplatten.", "Die Breite (60 oder 80 cm) muss zum Ausschnitt der Arbeitsplatte passen."]);
t("backofen", "Backofen", "Backofen- und Herd-Angebote", "Backofen|Herd-Set|Mikrowelle", { group: "kueche" },
  "Einbaubacköfen, Herd-Sets und Kombi-Mikrowellen im Angebot. Wir zeigen nur Deals mit echtem Preisvorteil.",
  ["Pyrolyse-Selbstreinigung spart viel Putzarbeit, kostet aber Aufpreis.", "Teleskopauszüge machen das Arbeiten mit schweren Blechen sicherer.", "Herd-Sets lohnen sich, wenn Ofen und Kochfeld zusammen getauscht werden."]);
t("dunstabzugshaube", "Dunstabzugshaube", "Dunstabzugshauben im Angebot", "Dunstabzug", { group: "kueche" },
  "Dunstabzugshauben gibt es als Wand-, Insel- und Flachschirmhaube. Hier findest du die aktuellen Angebote mit Preisverlauf.",
  ["Umluft braucht keinen Mauerdurchbruch, aber regelmäßig neue Aktivkohlefilter.", "Die Haube sollte mindestens so breit sein wie das Kochfeld.", "Lautstärke auf der Normalstufe vergleichen, nicht nur auf der niedrigsten."]);
t("heissluftfritteuse", "Heißluftfritteuse", "Heißluftfritteuse-Angebote (Airfryer)", "Heißluftfritteuse|Airfryer|Air Fryer", { group: "kueche", best: "beste-heissluftfritteuse" },
  "Airfryer von Ninja, Philips und anderen gehören zu den beliebtesten Küchengeräten. Wir zeigen nur Heißluftfritteusen-Deals, die wirklich günstiger als üblich sind.",
  ["Zwei Kammern (Dual Zone) garen Beilage und Hauptgericht gleichzeitig.", "Für 1 bis 2 Personen reichen 4 bis 5 Liter, für Familien 8 Liter und mehr.", "Spülmaschinenfeste Körbe sparen Zeit beim Reinigen."]);
t("kaffeevollautomat", "Kaffeevollautomat", "Kaffeevollautomat-Angebote", "Kaffeevollautomat|ECAM|Magnifica|PrimaDonna", { group: "kueche", best: "bester-kaffeevollautomat" },
  "Kaffeevollautomaten von De'Longhi, Philips, Siemens und anderen fallen regelmäßig deutlich unter ihren Listenpreis. Hier sind alle geprüften Angebote.",
  ["Automatisches Milchsystem (LatteCrema, LatteGo) ist bequemer als eine Dampfdüse.", "Herausnehmbare Brühgruppe lässt sich leichter sauber halten.", "Mahlwerk aus Keramik oder Stahl: beide gut, wichtiger ist die Einstellbarkeit."]);
t("kaffeemaschine", "Kaffeemaschine", "Kaffeemaschinen im Angebot: Siebträger, Kapsel & mehr", "Siebträger|Kapselmaschine|Nespresso|Vertuo|Kaffeebohnen|Milchaufschäumer|Luxe Café", { group: "kueche" },
  "Siebträger, Kapselmaschinen, Milchaufschäumer und Kaffeebohnen im Angebot. Kaffeevollautomaten findest du auf einer eigenen Seite.",
  ["Kapselmaschinen sind günstig in der Anschaffung, die Kapseln aber teuer pro Tasse.", "Siebträger mit integriertem Mahlwerk sind der günstigste Einstieg in echten Espresso.", "Kaffeebohnen in großen Packungen sind oft pro Kilo deutlich günstiger."]);
t("pizzaofen", "Pizzaofen", "Pizzaofen-Angebote", "Pizzaofen", { group: "kueche" },
  "Elektrische und Outdoor-Pizzaöfen im Angebot. Echte Neapolitanische Pizza braucht über 400 Grad, das schaffen nur spezielle Öfen.",
  ["Elektrische Pizzaöfen funktionieren auf dem Balkon und brauchen kein Gas.", "Die Maximaltemperatur entscheidet über knusprigen Boden in 2 bis 3 Minuten.", "Ein Pizzastein oder Schamottstein speichert die Hitze."]);
t("kuechenmaschine", "Küchenmaschine", "Küchenmaschinen und Küchenhelfer im Angebot", "Küchenmaschine|Reibe|Wassersprudler|SodaStream", { group: "kueche" },
  "Küchenmaschinen, Wassersprudler und praktische Küchenhelfer mit geprüftem Rabatt.",
  ["Bei Küchenmaschinen zählt die Motorleistung für schwere Teige.", "Zubehör (Fleischwolf, Gemüseschneider) einzeln nachzukaufen ist oft teuer, Sets lohnen sich.", "Wassersprudler: auf das CO₂-System achten (Quick-Connect oder Schraubzylinder)."]);
t("rasierer", "Rasierer", "Rasierer- und Bartschneider-Angebote", "Rasierer|Bartschneider|OneBlade", { group: "haushalt" },
  "Elektrische Rasierer und Bartschneider von Braun und Philips im Angebot, geprüft gegen den Preisverlauf.",
  ["Reinigungsstation spart Zeit, verursacht aber Folgekosten für Kartuschen.", "Folienrasierer sind gründlicher, Rotationsrasierer passen sich Konturen besser an.", "Wasserdichte Modelle lassen sich unter der Dusche nutzen."]);
t("elektrische-zahnbuerste", "elektrische Zahnbürste", "Elektrische Zahnbürsten im Angebot", "Zahnbürste|Aufsteckbürsten", { group: "haushalt", best: "beste-elektrische-zahnbuerste" },
  "Elektrische Zahnbürsten und Aufsteckbürsten von Oral-B und Philips im Angebot. Teure Top-Modelle sind oft um mehr als die Hälfte reduziert.",
  ["Andruckkontrolle schützt das Zahnfleisch.", "Die Ersatzbürsten machen über die Jahre den größten Teil der Kosten aus.", "App und Bluetooth sind nett, für saubere Zähne aber nicht nötig."]);
t("haarstyler", "Haarstyler", "Haartrockner und Haarstyler im Angebot", "Haarstyler|Haartrockner|Airwrap|FlexStyle|LED-Maske", { group: "haushalt" },
  "Haartrockner, Multistyler wie Shark FlexStyle und Beauty-Technik im Angebot.",
  ["Multistyler ersetzen Föhn, Glätteisen und Lockenstab.", "Mehrere Hitzestufen und Kaltluft schonen das Haar.", "Generalüberholte Geräte sind deutlich günstiger, haben aber oft kürzere Garantie."]);

/* TV & Audio */
t("fernseher", "Fernseher", "Fernseher-Angebote", "Fernseher|Smart-TV|QLED|Mini-LED-Fern", { group: "tv", cat: "tv", best: "bester-fernseher-55-zoll" },
  "OLED, QLED und Mini-LED: Fernseher werden über das Jahr deutlich günstiger, am stärksten zwischen Oktober und Dezember. Hier findest du alle geprüften TV-Deals.",
  ["OLED hat das beste Schwarz, Mini-LED ist heller für sonnige Räume.", "Für Konsolen: HDMI 2.1 mit 120 Hz.", "Faustregel Sitzabstand: 4K-Fernseher ab etwa dem 1,2-fachen der Bilddiagonale."]);
t("oled-fernseher", "OLED-Fernseher", "OLED-Fernseher im Angebot", "OLED", { group: "tv", cat: "tv", best: "bester-fernseher-55-zoll" },
  "OLED-Fernseher von LG und Samsung bieten perfektes Schwarz und sehr gute Blickwinkel. Vorjahresmodelle sind oft besonders günstig.",
  ["Die evo- und Top-Serien (z. B. LG G, Samsung S9x) sind heller als die Einstiegsmodelle.", "Einbrenn-Risiko ist bei normaler Nutzung heute gering.", "Vorjahresmodelle bieten oft das beste Preis-Leistungs-Verhältnis."]);
t("fernseher-55-zoll", "55-Zoll-Fernseher", "55-Zoll-Fernseher im Angebot", "55 Zoll|55\"", { group: "tv", cat: "tv", best: "bester-fernseher-55-zoll" },
  "55 Zoll ist die beliebteste Fernsehergröße in Deutschland. Hier findest du alle aktuellen 55-Zoll-Deals, egal ob OLED, QLED oder Mini-LED.",
  ["Für 55 Zoll passt ein Sitzabstand von etwa 1,7 bis 2,5 Metern.", "Achte auf echte 100/120 Hz, wenn du schnelle Spiele oder Sport schaust.", "Gute Fernseher kosten in dieser Größe oft weniger als ein 65-Zoll-Modell der Einsteigerklasse."]);
t("grosse-fernseher", "großer Fernseher", "Große Fernseher ab 65 Zoll im Angebot", "(6[5-9]|7\\d|8\\d|9\\d) Zoll", { group: "tv", cat: "tv" },
  "65, 75, 77, 83 oder 85 Zoll: Große Fernseher sind die Geräte mit den höchsten Rabatten in Euro. Hier findest du alle geprüften Deals ab 65 Zoll.",
  ["Sitzabstand ab etwa 2,5 Metern für 65 Zoll.", "Wandhalterung und Traglast der Wand vorher prüfen.", "Bei großen Bildern fallen Schwächen bei der Helligkeit stärker auf: QLED/Mini-LED für helle Räume."]);
t("soundbar", "Soundbar", "Soundbar-Angebote", "Soundbar|Theatre Bar|Sound-?bar|Boom", { group: "tv", art: "soundbar-vergleich" },
  "Soundbars von Bose, Sony, Samsung, Denon und anderen verbessern den Fernsehton enorm. Hier sind alle aktuellen Soundbar-Deals.",
  ["HDMI eARC überträgt Dolby Atmos vom Fernseher zur Soundbar.", "Ein separater Subwoofer bringt deutlich mehr Bass.", "Dolby Atmos lohnt sich vor allem mit Upfiring-Lautsprechern."]);
t("bluetooth-lautsprecher", "Bluetooth-Lautsprecher", "Bluetooth-Lautsprecher-Angebote", "Lautsprecher|Speaker", { group: "audio", art: "bluetooth-lautsprecher-vergleich" },
  "Bluetooth-Boxen von JBL, Bose, Sony, Marshall und soundcore im Angebot. Wir prüfen jeden Preis gegen den Verlauf.",
  ["Wasserschutz IP67 für Strand und Pool.", "Akkulaufzeit gilt meist für mittlere Lautstärke.", "Stereo-Kopplung zweier Boxen bringt mehr Raumklang."]);
t("kopfhoerer", "Kopfhörer", "Kopfhörer-Angebote", "Kopfhörer|AirPods|Earbuds|In-Ears", { group: "audio", best: "beste-kopfhoerer-unter-100-euro" },
  "Over-Ear, In-Ear und True Wireless: Kopfhörer von Sony, Bose, Apple, JBL und soundcore im Angebot. Hier sind alle geprüften Deals.",
  ["Aktive Geräuschunterdrückung (ANC) lohnt sich für Pendler und Großraumbüros.", "Multipoint verbindet Handy und Laptop gleichzeitig.", "Codecs wie LDAC oder aptX bringen nur etwas, wenn dein Handy sie unterstützt."]);
t("in-ear-kopfhoerer", "In-Ear-Kopfhörer", "In-Ear-Kopfhörer und True Wireless im Angebot", "In-Ear|Earbuds|AirPods|True-Wireless|In-Ears", { group: "audio", best: "beste-kopfhoerer-unter-100-euro" },
  "True-Wireless-In-Ears von Apple, Sony, Bose, JBL und soundcore im Angebot.",
  ["Mehrere Ohrstöpsel-Größen sind wichtig für Sitz und Geräuschunterdrückung.", "Kabelloses Laden des Cases ist praktisch, aber kein Muss.", "Für Sport: IPX4 oder höher."]);
t("noise-cancelling-kopfhoerer", "Noise-Cancelling-Kopfhörer", "Noise-Cancelling-Kopfhörer im Angebot", "Noise|ANC|QuietComfort|Space One", { group: "audio", best: "beste-noise-cancelling-kopfhoerer" },
  "Kopfhörer mit aktiver Geräuschunterdrückung (ANC) im Angebot, von günstigen soundcore-Modellen bis Bose QuietComfort.",
  ["Gutes ANC filtert vor allem tiefe, gleichmäßige Geräusche wie Flugzeug und Bahn.", "Transparenzmodus ist wichtig im Straßenverkehr.", "Over-Ear dämpft meist besser als In-Ear."]);

/* Computer */
t("laptop", "Laptop", "Laptop-Angebote", "Laptop|Notebook|OmniBook", { group: "computer" },
  "Laptops von HP, Lenovo, MSI, Gigabyte und anderen im Angebot. Wir prüfen Preis und Ausstattung, damit du kein Auslaufmodell zum Neupreis kaufst.",
  ["16 GB RAM sind heute das sinnvolle Minimum.", "Eine SSD ab 512 GB vermeidet Speicherknappheit.", "Für Büro und Studium zählen Akku, Display-Helligkeit und Gewicht mehr als ein schneller Prozessor."]);
t("gaming-laptop", "Gaming-Laptop", "Gaming-Laptop-Angebote", "Gaming-Laptop|Gaming A16|Legion|Cyborg|ROG.*Laptop", { group: "computer" },
  "Gaming-Laptops mit RTX-Grafik im Angebot. Grafikkarte und Kühlung entscheiden mehr über die Leistung als der Prozessor.",
  ["Achte auf die Grafikkarte und deren Leistungsaufnahme (TGP).", "Ein Display mit 144 Hz oder mehr ist für Spiele Pflicht.", "Viele Gaming-Laptops sind laut unter Last; Testberichte lesen."]);
t("monitor", "Monitor", "Monitor-Angebote", "Monitor|ZenScreen|FlexScan", { group: "computer", best: "bester-gaming-monitor" },
  "Office-, Gaming- und OLED-Monitore von Samsung, ASUS, MSI, HP, LG und Lenovo im Angebot.",
  ["Für Büroarbeit: 27 Zoll mit WQHD-Auflösung ist der beste Kompromiss.", "USB-C mit Stromversorgung macht den Monitor zur Dockingstation für Laptops.", "Höhenverstellbarer Fuß ist gut für den Rücken."]);
t("gaming-monitor", "Gaming-Monitor", "Gaming-Monitor-Angebote", "Gaming-Mon|Odyssey|ROG|Omen.*Monitor|OMEN 27|MAG |Strix|TUF Gaming", { group: "computer", best: "bester-gaming-monitor" },
  "Gaming-Monitore mit 144 bis 500 Hz, von günstigen IPS-Modellen bis OLED. Alle Deals gegen den Preisverlauf geprüft.",
  ["Bildwiederholrate und Reaktionszeit sind für schnelle Spiele am wichtigsten.", "G-Sync oder FreeSync verhindern Bildrisse.", "WQHD mit 165 Hz ist der Sweet Spot für die meisten Grafikkarten."]);
t("oled-monitor", "OLED-Monitor", "OLED-Monitore im Angebot", "OLED.*(Mon|Gaming)|QD-OLED|WOLED", { group: "computer", cat: "computer", best: "bester-gaming-monitor" },
  "QD-OLED- und WOLED-Monitore bieten perfekte Kontraste und extrem kurze Reaktionszeiten. Die Preise fallen gerade schnell.",
  ["Achte auf die Garantie gegen Einbrennen (oft 2 bis 3 Jahre).", "QD-OLED hat kräftigere Farben, WOLED schärfere Schrift.", "Für Büroarbeit mit viel statischem Inhalt ist ein IPS-Monitor oft die bessere Wahl."]);
t("mini-pc", "Mini-PC", "Mini-PC-Angebote", "Mini-PC|ThinkCentre", { group: "computer" },
  "Mini-PCs sind klein, sparsam und reichen für Büro, Streaming und Homeserver. Hier sind die aktuellen Angebote.",
  ["Achte auf erweiterbaren RAM und einen zweiten SSD-Slot.", "Für Homeserver: zwei LAN-Ports und geringer Leerlaufverbrauch.", "Gebrauchte Business-Mini-PCs (Lenovo, HP, Dell) sind sehr günstig und robust."]);
t("nas", "NAS", "NAS-Angebote", "NAS", { group: "computer" },
  "Netzwerkspeicher (NAS) für Fotos, Backups und Streaming im Angebot.",
  ["Plane mindestens zwei Festplatten für RAID 1 (Spiegelung).", "Ein NAS ersetzt kein externes Backup.", "2,5-Gbit-LAN lohnt sich bei großen Datenmengen."]);
t("wlan-router", "WLAN-Router", "WLAN-Router und Mesh-Angebote", "Router|Mesh|Orbi|Nighthawk|WLAN-USB", { group: "computer" },
  "Wi-Fi-7- und Wi-Fi-6-Router, Mesh-Systeme und mobile 5G-Router im Angebot.",
  ["Mesh-Systeme verteilen WLAN in großen Wohnungen und Häusern gleichmäßig.", "Wi-Fi 7 lohnt sich nur, wenn deine Geräte es unterstützen.", "Mobile 5G-Router sind eine Alternative, wenn kein Festnetz verfügbar ist."]);
t("netzwerk-switch", "Switch", "Netzwerk-Switch-Angebote", "Switch(?!Bot)|PoE", { group: "computer" },
  "Gigabit-, 2,5G- und 10G-Switches sowie PoE-Switches im Angebot.",
  ["Unmanaged Switches sind einfach: einstecken und fertig.", "PoE versorgt Kameras und Access Points über das Netzwerkkabel mit Strom.", "2,5G lohnt sich, wenn NAS und PC passende Anschlüsse haben."]);
t("gaming-stuhl", "Gaming-Stuhl", "Gaming-Stuhl-Angebote", "Gaming-Stuhl", { group: "computer" },
  "Gaming-Stühle und ergonomische Bürostühle von AutoFull und anderen im Angebot.",
  ["Einstellbare Lordosenstütze ist wichtiger als die Optik.", "Achte auf die maximale Belastbarkeit und Körpergröße.", "Stoff ist atmungsaktiver als Kunstleder."]);
t("gaming-maus-tastatur", "Gaming-Maus", "Gaming-Maus und Tastatur im Angebot", "Maus|Tastatur", { group: "computer" },
  "Gaming-Mäuse, mechanische Tastaturen und ergonomische Mäuse im Angebot.",
  ["Kabellose Gaming-Mäuse sind heute so schnell wie kabelgebundene.", "Tenkeyless (TKL) spart Platz für die Maus.", "Vertikale Mäuse entlasten das Handgelenk."]);
t("pc-komponenten", "PC-Gehäuse", "PC-Komponenten im Angebot: Gehäuse, Kühlung & mehr", "Gehäuse|Wasserkühlung|AiO|Kraken|Light Base", { group: "computer" },
  "PC-Gehäuse, AiO-Wasserkühlungen und weitere Komponenten im Angebot.",
  ["Prüfe die maximale Grafikkartenlänge und Kühlerhöhe des Gehäuses.", "240-mm-AiOs reichen für die meisten Prozessoren.", "Gute Gehäuse-Lüfter verbessern Temperatur und Lautstärke deutlich."]);
t("tablet", "Tablet", "Tablet-Angebote", "Tablet|Tab S|Idea Tab", { group: "computer" },
  "Tablets von Samsung, Lenovo und anderen im Angebot.",
  ["Für Streaming: Display mit hoher Helligkeit und guten Lautsprechern.", "Stift-Unterstützung ist für Notizen und Zeichnen wichtig.", "Achte auf die Dauer der Software-Updates."]);
t("drucker", "Drucker", "Drucker-Angebote", "drucker", { group: "computer" },
  "Laser-, Tintenstrahl- und Etikettendrucker im Angebot.",
  ["Farblaser lohnen sich bei viel Text, Tintentank-Drucker bei vielen Fotos.", "Rechne die Kosten pro Seite, nicht nur den Gerätepreis.", "Duplex-Druck spart Papier."]);
t("dockingstation", "Dockingstation", "Dockingstation- und USB-C-Hub-Angebote", "Docking|Revodok", { group: "computer" },
  "USB-C- und Thunderbolt-Dockingstationen im Angebot.",
  ["Prüfe die Ladeleistung (Power Delivery) für deinen Laptop.", "Für zwei Monitore braucht dein Laptop DisplayPort-Alt-Mode oder Thunderbolt.", "Thunderbolt-Docks sind schneller, aber teurer."]);

/* Smartphone & Wearables */
t("smartphone", "Smartphone", "Smartphone-Angebote ohne Vertrag", "Smartphone|Galaxy A|Galaxy Z|Pixel 10|POCO|moto|Moto G|NXTPAPER", { group: "phone", cat: "phone", art: "guenstige-smartphones" },
  "Handys ohne Vertrag von Samsung, Google, Motorola, Xiaomi und anderen im Angebot. Wir prüfen den Preis gegen den Verlauf.",
  ["Achte auf die Dauer der Sicherheitsupdates (Samsung und Google: viele Jahre).", "128 GB Speicher sind das Minimum, wenn kein microSD-Slot vorhanden ist.", "Vorjahresmodelle der Mittelklasse sind oft die besten Deals."]);
t("smartwatch", "Smartwatch", "Smartwatch-Angebote", "Watch|Venu|Amazfit", { group: "phone", cat: "watch", best: "beste-smartwatch", art: "smartwatch-vergleich" },
  "Smartwatches von Samsung, Google, Huawei, Garmin, Amazfit und Xiaomi im Angebot.",
  ["Prüfe die Kompatibilität mit deinem Handy (iPhone oder Android).", "Akkulaufzeit reicht von einem Tag bis zu zwei Wochen.", "Für Sport: GPS integriert und gute Pulsmessung."]);
t("verkehrswarner", "Verkehrswarner", "Verkehrswarner-Angebote", "Verkehrswarner", { group: "phone" },
  "Verkehrswarner wie OOONO und Needit im Angebot. Sie warnen vor Gefahrenstellen und Staus.",
  ["Wichtig: Die Nutzung von Blitzer-Warnfunktionen ist für Fahrer in Deutschland während der Fahrt verboten (§ 23 StVO).", "Prüfe, ob ein Abo für Zusatzfunktionen nötig ist.", "Die Geräte nutzen meist das Handy per Bluetooth."]);

/* Smart Home */
t("ueberwachungskamera", "Überwachungskamera", "Überwachungskamera-Angebote", "Kamera(?!.*Action)|Cam(?!era)|eufyCam|SolarCam|WirelessCam", { group: "smarthome", cat: "smarthome", best: "beste-ueberwachungskamera-aussen" },
  "Überwachungskameras für außen und innen von aosu, eufy, EZVIZ, Imou und anderen im Angebot.",
  ["Lokaler Speicher (SD-Karte, HomeBase) spart Cloud-Abo-Kosten.", "Solarpanel verlängert die Akkulaufzeit bei Außenkameras.", "Beim Filmen öffentlicher Bereiche und Nachbargrundstücke gelten in Deutschland enge Grenzen."]);
t("video-tuerklingel", "Video-Türklingel", "Video-Türklingel-Angebote", "Doorbell|Türklingel", { group: "smarthome" },
  "Video-Türklingeln mit App, Gegensprechfunktion und Bewegungserkennung im Angebot.",
  ["Akku-Modelle sind leichter zu installieren, verdrahtete laufen dauerhaft.", "Prüfe, ob Aufnahmen lokal gespeichert werden.", "Mit Gong-Anbindung klingelt es auch ohne Handy."]);
t("smart-home-zubehoer", "Smart-Home", "Smart-Home-Zubehör im Angebot", "Steckdose|Rauchmelder|Bewässerungssteuerung|Ventilator|Strahler", { group: "smarthome", cat: "smarthome" },
  "Smarte Steckdosen, Rauchmelder, Bewässerung und mehr im Angebot.",
  ["Achte auf den Standard (WLAN, Zigbee, Matter) und deine bestehende Smart-Home-Zentrale.", "Matter-Geräte funktionieren mit Apple, Google und Amazon.", "Smarte Steckdosen mit Strommessung zeigen versteckte Stromfresser."]);
t("luftreiniger", "Luftreiniger", "Luftreiniger-Angebote", "Luftreiniger", { group: "smarthome", best: "bester-luftreiniger" },
  "Luftreiniger mit HEPA-Filter im Angebot.",
  ["Die CADR-Angabe zeigt, wie viel Luft pro Stunde gereinigt wird.", "Filterkosten pro Jahr vergleichen.", "Für Schlafzimmer: Nachtmodus unter 30 dB."]);

/* Garten, Werkzeug, Mobilität */
t("maehroboter", "Mähroboter", "Mähroboter-Angebote", "Mähroboter", { group: "garten", best: "beste-maehroboter", art: "maehroboter-ohne-begrenzungskabel" },
  "Mähroboter mit und ohne Begrenzungskabel im Angebot. Die besten Preise gibt es im Herbst und Winter.",
  ["Modelle ohne Begrenzungsdraht (RTK oder Kamera) sparen die Verlegung.", "Die angegebene Rasenfläche ist ein Maximalwert, plane Reserve ein.", "Steigung und enge Durchgänge prüfen."]);
t("rasenmaeher-gartengeraete", "Akku-Rasenmäher", "Gartengeräte im Angebot: Rasenmäher, Heckenschere & mehr", "Rasenmäher|Heckenschere|Kettensäge|Hauswasserwerk|Outdoor Clean", { group: "garten" },
  "Akku-Rasenmäher, Heckenscheren, Kettensägen, Hauswasserwerke und mehr für den Garten im Angebot.",
  ["Bleib bei einem Akku-System, dann passen die Akkus in alle Geräte.", "Für kleine Gärten reicht ein Akku-Rasenmäher mit 32 bis 37 cm Schnittbreite.", "Hauswasserwerke: Förderhöhe und -menge zur Anwendung passend wählen."]);
t("akkuschrauber", "Akkuschrauber", "Akkuschrauber- und Werkzeug-Angebote", "Akkuschrauber|Bohrschraub|Bohrschraube|Akku 18 V|Multitool|Schraubendreher", { group: "werkzeug" },
  "Akkuschrauber, Bohrschrauber und Handwerkzeug von Bosch, Worx, Stanley, Wera und Hazet im Angebot.",
  ["Für Möbel und Bilder reicht ein kleiner 3,6-V-Schrauber.", "Schlagbohrschrauber für Löcher in Mauerwerk.", "Bleib bei einem Akku-System, das spart viel Geld."]);
t("wallbox", "Wallbox", "Wallbox-Angebote für E-Autos", "Wallbox", { group: "werkzeug" },
  "Mobile und fest installierte Wallboxen für Elektroautos im Angebot.",
  ["Wallboxen bis 11 kW müssen beim Netzbetreiber angemeldet werden.", "Mobile Wallboxen mit CEE-Stecker sind flexibel für Mieter.", "Die Installation einer festen Wallbox gehört in die Hände einer Elektrofachkraft."]);
t("e-bike", "E-Bike", "E-Bike-Angebote", "E-Bike", { group: "sport" },
  "E-Bikes für Stadt, Trekking und Gelände im Angebot.",
  ["Mittelmotor fährt sich natürlicher, Heckmotor ist günstiger.", "Drehmomentsensor reagiert feinfühliger als ein Trittfrequenzsensor.", "Akkukapazität ab 500 Wh für längere Touren."]);
t("fahrrad", "Fahrrad", "Fahrrad-Angebote: Mountainbike, Kinderfahrrad & mehr", "Fahrrad|Mountainbike|Kinder-Mountainbike", { group: "sport", not: "E-Bike|Luftpumpe" },
  "Fahrräder, Mountainbikes und Kinderfahrräder im Angebot.",
  ["Rahmengröße passend zur Körpergröße wählen.", "Für Kinder: 20 Zoll ab etwa 6 Jahren.", "Scheibenbremsen bremsen bei Nässe zuverlässiger."]);
t("kinderfahrzeuge", "Kinder-Elektroauto", "Kinderfahrzeuge im Angebot: Elektroauto, Roller & Hoverboard", "Rutschauto|Kinder-Elektromotorrad|Kinderroller|Hoverboard|Elektromotorrad", { group: "spielzeug" },
  "Elektrische Kinderautos, Kindermotorräder, E-Roller und Hoverboards im Angebot.",
  ["Auf Altersempfehlung und Höchstgeschwindigkeit achten.", "Fernbedienung für Eltern ist bei kleinen Kindern sinnvoll.", "Hoverboards und E-Roller nur mit Helm und Schutzausrüstung."]);
t("actioncam", "Actioncam", "Actioncam-Angebote", "Actionkamera|Action-Cam|Insta360|GoPro", { group: "sport" },
  "Actioncams von Insta360, DJI und GoPro im Angebot.",
  ["Bildstabilisierung ist wichtiger als die maximale Auflösung.", "Wasserdicht ohne Gehäuse ist praktisch.", "360-Grad-Kameras erlauben das Ausrichten des Bildes nach der Aufnahme."]);
t("drohne", "Drohne", "Drohnen-Angebote", "Drohne", { group: "spielzeug" },
  "Drohnen und Mini-Drohnen von DJI im Angebot.",
  ["Unter 250 g gelten in der EU erleichterte Regeln, eine Haftpflichtversicherung brauchst du trotzdem.", "Fly-More-Combos mit Zusatzakkus lohnen sich fast immer.", "Kennzeichnung mit e-ID ist in Deutschland für die meisten Drohnen mit Kamera Pflicht."]);

/* Spielzeug */
t("lego-star-wars", "LEGO Star Wars", "LEGO Star Wars im Angebot", "LEGO Star Wars", { group: "spielzeug", art: "lego-angebote" },
  "LEGO Star Wars Sets im Angebot, vom kleinen Raumschiff bis zum großen UCS-Modell.",
  ["Sets laufen meist nach 1 bis 2 Jahren aus, danach steigen die Preise oft.", "Der Preis pro Teil hilft beim Vergleich.", "Große Sets gibt es zu Aktionstagen oft am günstigsten."]);
t("lego-technic", "LEGO Technic", "LEGO Technic im Angebot", "LEGO Technic", { group: "spielzeug", art: "lego-angebote" },
  "LEGO Technic Fahrzeuge und Maschinen im Angebot.",
  ["Achte auf Funktionen wie Motoren und Getriebe.", "Für Kinder ab etwa 9 bis 10 Jahren, große Sets ab 18.", "Lizenzmodelle (McLaren, Volvo) sind beliebte Geschenke."]);
t("lego-speed-champions", "LEGO Speed Champions", "LEGO Speed Champions und Autos im Angebot", "Speed Champions|LEGO Icons.*(Jaguar|E-Type)|Batmobile", { group: "spielzeug", art: "lego-angebote" },
  "LEGO Speed Champions, Icons-Autos und andere Auto-Sets im Angebot.",
  ["Speed Champions sind günstige Sammler-Sets.", "Icons-Autos sind detailreiche Ausstellungsstücke für Erwachsene.", "Mehrere kleine Sets gemeinsam bestellen spart Versand."]);
t("bausatz-cobi", "COBI Bausatz", "Bausätze und Klemmbausteine im Angebot", "COBI|Bausatz", { group: "spielzeug" },
  "Klemmbaustein-Bausätze von COBI und anderen im Angebot.",
  ["COBI ist kompatibel mit LEGO-Steinen.", "Militär- und Oldtimer-Modelle sind COBIs Spezialität.", "Maßstab und Teilezahl helfen beim Vergleich."]);

/* Vegan */
t("veganes-proteinpulver", "veganes Proteinpulver", "Veganes Proteinpulver im Angebot", "Proteinpulver|Protein-|Erbsenprotein|Sojaprotein|Proteinmischung", { group: "vegan", vegan: true },
  "Veganes Proteinpulver aus Erbse, Soja und Mischungen im Angebot. Nur Produkte, die ausdrücklich als vegan gekennzeichnet sind.",
  ["Mischungen aus mehreren Pflanzenquellen haben ein vollständigeres Aminosäureprofil.", "Preis pro Kilo vergleichen, Großpackungen sind oft deutlich günstiger.", "Geschmacksneutrale Varianten eignen sich auch zum Backen."]);
t("vegane-supplements", "vegane Nahrungsergänzung", "Vegane Nahrungsergänzung im Angebot: B12, Omega 3, Kreatin", "Vitamin|Zink|Magnesium|Omega|Gummies|Calcium|Kreatin|Creatine|Glutamin|Carnitin|Inulin|Superfoods", { group: "vegan", vegan: true },
  "Vitamin B12, veganes Omega 3 aus Algenöl, Kreatin und weitere vegane Nahrungsergänzung im Angebot.",
  ["Vitamin B12 ist für Veganer wichtig; lass deine Werte ärztlich prüfen.", "Veganes Omega 3 stammt aus Algenöl.", "Kreatin-Monohydrat ist von Natur aus vegan, die Kapselhülle nicht immer."]);
t("nussbutter", "Erdnussbutter", "Erdnussbutter und Nussmus im Angebot", "Erdnussbutter|Mandelbutter|Nussbutter", { group: "vegan", vegan: true },
  "Erdnussbutter, Mandelmus und Nussbutter im Angebot, ausdrücklich vegan.",
  ["Naturbelassene Varianten ohne Zucker und Palmöl bevorzugen.", "Ölschicht oben ist normal, einfach umrühren.", "Pulverisierte Erdnussbutter hat weniger Fett."]);
t("vegane-schuhe", "vegane Schuhe", "Vegane Schuhe und Sneaker im Angebot", "Sneaker|Schuh|Boots|Lauflern", { group: "vegan", vegan: true },
  "Vegane Sneaker, Boots und Kinderschuhe ohne Leder im Angebot. Nur Modelle, die Hersteller ausdrücklich als vegan kennzeichnen.",
  ["Achte auf das Vegan-Label des Herstellers, nicht nur auf „Kunstleder“: Auch Kleber kann tierisch sein.", "Mikrofaser und Bio-Baumwolle sind atmungsaktiv.", "Dr. Martens Vegan und Skechers BOBS haben eigene vegane Linien."]);
t("vegane-mode", "vegane Mode", "Vegane Mode und Accessoires im Angebot", "Jacke|Blouson|Shopper|Tasche|Gürtel|Geldbörse", { group: "vegan", vegan: true },
  "Vegane Jacken, Taschen und Accessoires ohne Leder, Wolle und Daunen im Angebot.",
  ["Vegane Wolle-Alternativen sind meist Polyester oder Baumwollmischungen.", "Kork, Apfelleder und Piñatex sind Leder-Alternativen.", "Auf die Pflegehinweise achten, damit die Materialien lange halten."]);
t("vegane-kosmetik", "vegane Kosmetik", "Vegane Kosmetik im Angebot", "Serum|Palette|Kosmetik|Augenbrauen", { group: "vegan", vegan: true },
  "Vegane Kosmetik und Pflege im Angebot, ausdrücklich als vegan gekennzeichnet.",
  ["Vegan heißt ohne tierische Inhaltsstoffe; tierversuchsfrei ist ein eigenes Siegel.", "Auf Siegel wie die Vegan-Blume achten.", "Probiergrößen sind ein günstiger Einstieg."]);

t("fernseher-75-zoll", "Fernseher 75 Zoll", "75-Zoll-Fernseher im Angebot", "75 Zoll|75\"|75-Zoll|75T|75Q|75U|GQ75|QE75|OLED75", { cat: "tv", group: "tv" },
  "Große 75-Zoll-Fernseher mit geprüftem Rabatt: QLED, Mini-LED und OLED.",
  ["Für 75 Zoll empfehlen Hersteller bei 4K meist etwa 1,6 bis 2,5 Meter Sitzabstand.", "Vor dem Kauf Breite und Standfuß mit dem TV-Möbel abgleichen, große Geräte sind oft über 1,65 m breit.", "Für Spielekonsolen auf HDMI 2.1 mit 120 Hz achten.", "Mini-LED und OLED liefern meist besseren Kontrast als einfache LED-Panels."]);
t("fernseher-65-zoll", "Fernseher 65 Zoll", "65-Zoll-Fernseher im Angebot", "65 Zoll|65\"|65-Zoll|65T|65Q|65U|GQ65|QE65|OLED65", { cat: "tv", group: "tv" },
  "65-Zoll-Fernseher mit geprüftem Rabatt, vom günstigen 4K-LED bis zum OLED.",
  ["Für 65 Zoll in 4K liegt der empfohlene Sitzabstand meist bei etwa 1,4 bis 2,2 Metern.", "Für Konsolen auf HDMI 2.1, VRR und 120 Hz achten.", "Eine Soundbar verbessert den Ton flacher Geräte deutlich.", "Den Preisverlauf prüfen: TV-Preise fallen oft einige Monate nach Marktstart."]);
t("playmobil-angebote", "PLAYMOBIL", "PLAYMOBIL-Angebote", "PLAYMOBIL", { cat: "toys", group: "spielzeug" },
  "PLAYMOBIL-Sets mit geprüftem Rabatt, ideal als Geschenk.",
  ["Altersangabe auf der Packung beachten, viele Sets enthalten Kleinteile.", "Sets einer Themenwelt lassen sich meist miteinander kombinieren.", "Vor Weihnachten früh kaufen, beliebte Sets sind dann schnell vergriffen.", "Den Preisverlauf prüfen: viele Sets sind deutlich unter UVP zu haben."]);
t("carrera-angebote", "Carrera", "Carrera-Angebote: Rennbahnen & RC-Autos", "Carrera", { cat: "toys", group: "spielzeug" },
  "Carrera-Rennbahnen (GO!!!, Digital, First) und Carrera-RC-Autos mit geprüftem Rabatt.",
  ["Auf den Maßstab achten: Carrera First (1:50) für Kleinkinder, GO!!! (1:43) für Einsteiger, Digital 132/124 für Fortgeschrittene.", "Autos und Schienen passen nur innerhalb desselben Systems zusammen.", "Ausbauschienen und Erweiterungssets gibt es oft günstiger als neue Grundpackungen.", "Vor Weihnachten den Preisverlauf prüfen: Rennbahn-Sets schwanken stark."]);
t("carrera-rennbahn", "Carrera Bahn", "Carrera-Rennbahn im Angebot", "Carrera.*(Bahn|GO!!!|Digital|First|Evolution)|Rennbahn", { cat: "toys", group: "spielzeug" },
  "Carrera-Rennbahnen von First bis Digital 132 mit geprüftem Rabatt.",
  ["Carrera First ist ab ca. 3 Jahren gedacht, GO!!! ab ca. 6 Jahren.", "Digital-Bahnen erlauben Spurwechsel und mehrere Autos pro Spur.", "Platzbedarf vorher messen: viele Grundpackungen brauchen über 3 Meter Fläche.", "Ersatz-Schleifer und Leitkiele für die Autos günstig mitbestellen."]);
t("vorratsdeals", "Vorratsdeals Verbrauchsartikel", "Vorratsdeals: Verbrauchsartikel stark reduziert", "Waschmittel|Spülmaschinentabs|Geschirrspültabs|Weichspüler|Spülmittel|Allzweckreiniger|Glasreiniger|Toilettenpapier|Küchenrolle|Taschentücher|Müllbeutel|Müllsäcke|Rasierklingen|Ersatzklingen|Aufsteckbürsten|Zahnpasta|Duschgel|Shampoo|\\bDeo|Sonnencreme|Batterien AA|Druckerpatrone|Tintenpatrone|Kopierpapier|Filter-?[Kk]artusche|Gefrierbeutel|Backpapier|Kaffeebohnen|Kaffeekapseln|Windeln|Feuchttücher|Katzenstreu|Scheibenreiniger", { group: "haushalt" },
  "Dinge, die man sowieso regelmäßig kauft – Waschmittel, Spülmaschinentabs, Rasierklingen, Batterien, Kaffee und mehr – mit starkem, geprüftem Rabatt. Ideal zum Vorrat-Anlegen.",
  ["Auf den Grundpreis achten (€ pro Waschladung, pro Tab, pro 100 g) – große Packungen sind nicht immer günstiger.", "Bei Amazon lohnt sich oft „Spar-Abo“: zusätzlich 5–15 % Rabatt, jederzeit kündbar.", "Nur so viel bevorraten, wie vor dem Mindesthaltbarkeitsdatum verbraucht wird.", "Lebensmittel nehmen wir nur auf, wenn sie vegan sind."]);
t("switch-spiele", "Switch-Spiele", "Nintendo-Switch-Spiele im Angebot", "Nintendo Switch|Switch 2|\\bSwitch\\b", { group: "computer" },
  "Spiele für Nintendo Switch und Switch 2 mit geprüftem Rabatt.",
  ["Auf die Plattform achten: Switch-2-Editionen laufen nicht auf der ersten Switch.", "Viele Switch-1-Spiele laufen auch auf der Switch 2.", "Nintendo-Spiele werden selten stark reduziert, ein guter Preis lohnt sich deshalb.", "Physische Spiele lassen sich später weiterverkaufen."]);
t("wasserkocher", "Wasserkocher", "Wasserkocher im Angebot", "Wasserkocher", { cat: "kitchen", group: "kueche" },
  "Wasserkocher mit geprüftem Rabatt, mit und ohne Temperaturwahl.",
  ["Eine Temperaturwahl hilft bei grünem Tee und Babynahrung.", "Ein Edelstahl- oder Glasgehäuse hält meist länger als Kunststoff.", "Regelmäßig entkalken spart Strom und verlängert die Lebensdauer.", "1,7 Liter reichen für die meisten Haushalte."]);
t("hochdruckreiniger", "Hochdruckreiniger", "Hochdruckreiniger im Angebot", "Hochdruckreiniger|Aquatak|Kärcher K", { cat: "garden", group: "garten" },
  "Hochdruckreiniger mit geprüftem Rabatt für Terrasse, Auto und Fahrrad.",
  ["Für Auto und Fahrrad reicht meist weniger Druck, für Steinplatten hilft ein Flächenreiniger.", "Auf die Fördermenge (Liter pro Stunde) achten, nicht nur auf den Druck in bar.", "Ein Kit mit Zubehör ist oft günstiger als Einzelteile.", "Im Winter frostfrei lagern."]);
t("babyphone", "Babyphone", "Babyphone im Angebot", "Babyphone|Babyfon", { cat: "home", group: "haushalt" },
  "Babyphones mit geprüftem Rabatt, mit Audio oder Kamera.",
  ["DECT-Geräte funken verschlüsselt und störungsarm, ohne WLAN.", "Reichweite und Akkulaufzeit der Elterneinheit vergleichen.", "Das Gerät mit Abstand zum Kinderbett aufstellen.", "Kamera-Babyphones mit App vorher auf Datenschutz prüfen."]);

/* Preisgrenzen */
t("echo-alexa", "Echo Angebote", "Amazon Echo & Alexa im Angebot", "\\bEcho (Dot|Show|Spot|Pop|Studio|Hub)|\\bEcho\\b.*Alexa", { cat: "smarthome", group: "smarthome" },
  "Echo Dot, Echo Show, Echo Spot und andere Alexa-Geräte mit geprüftem Rabatt. Amazon senkt die Preise seiner eigenen Geräte regelmäßig stark.",
  ["Echo-Geräte sind zu Aktionen wie Black Friday und Prime Day oft 40–60 % günstiger.", "Echo Show hat ein Display für Videoanrufe, Rezepte und Kameras, Echo Dot ist der günstige Einstieg.", "Für Smart Home ohne Hub reicht meist ein Echo mit Matter-Unterstützung.", "Ältere Generationen sind oft besonders stark reduziert, bekommen aber weiter Updates."]);
t("kindle", "Kindle Angebote", "Kindle im Angebot: E-Reader von Amazon", "Kindle", { cat: "computer", group: "computer" },
  "Kindle, Kindle Paperwhite, Kindle Kids, Colorsoft und Scribe mit geprüftem Rabatt.",
  ["Der Paperwhite ist wasserdicht und hat eine warme Beleuchtung, das Einstiegsmodell nicht.", "Kids-Modelle haben 2 Jahre Sorglos-Garantie und eine Hülle dabei.", "Die Version „mit Werbung“ ist günstiger, die Werbung lässt sich später gegen Gebühr entfernen.", "Kindle-Preise sinken zu Prime Day und Black Friday am stärksten."]);
t("fire-tv-stick", "Fire TV Stick Angebote", "Fire TV Stick & Fire TV im Angebot", "Fire TV", { cat: "tv", group: "tv" },
  "Fire TV Stick, Fire TV Cube, Fire-TV-Fernseher und Soundbars mit geprüftem Rabatt.",
  ["Für 4K-Fernseher lohnt der Fire TV Stick 4K bzw. 4K Max, für ältere HD-Fernseher reicht der einfache Stick.", "Wi-Fi 6 hilft bei schwachem WLAN im Wohnzimmer.", "Fire-TV-Sticks sind zu Aktionstagen oft um die Hälfte reduziert.", "Ein USB-Netzteil statt des TV-USB-Ports vermeidet Neustarts."]);
t("lego-angebote", "LEGO Angebote", "LEGO-Angebote: alle reduzierten Sets", "\\bLEGO\\b", { cat: "toys", group: "spielzeug" },
  "Alle LEGO-Sets mit geprüftem Rabatt: Star Wars, Technic, City, Creator, Speed Champions und mehr.",
  ["Wir vergleichen mit dem Preisverlauf, nicht nur mit der UVP: LEGO ist oft 20–40 % unter UVP zu haben.", "Sets kurz vor dem Auslaufen (EOL) werden später oft teurer.", "Bei Amazon, Alternate und OTTO gibt es regelmäßig Bestpreise.", "Für Sammler: Karton unbeschädigt lassen, das erhöht den Wiederverkaufswert."]);
t("brettspiele", "Brettspiele Angebote", "Brettspiele & Gesellschaftsspiele im Angebot", "Brettspiel|Gesellschaftsspiel|Familienspiel|(?<!Sammel)Kartenspiel|Kinderspiel|Catan|Karak", { cat: "toys", group: "spielzeug" },
  "Brettspiele, Familienspiele und Kartenspiele von KOSMOS, Ravensburger, Hasbro und anderen mit geprüftem Rabatt.",
  ["Auf Spieleranzahl und Spieldauer achten, das steht auf jeder Schachtel.", "Altersangaben sind Richtwerte, für jüngere Kinder gibt es oft eigene Junior-Versionen.", "Erweiterungen nur kaufen, wenn das Grundspiel schon da ist.", "Vor Weihnachten sind viele Spiele stark reduziert."]);
t("gaming-headset", "Gaming Headset Angebote", "Gaming-Headsets im Angebot", "Gaming.?Headset|Quantum \\d|G733|G435|Arctis|HyperX Cloud|BlackShark", { cat: "headphones", group: "audio" },
  "Gaming-Headsets von Logitech, JBL, SteelSeries, HyperX, Razer und anderen mit geprüftem Rabatt.",
  ["Kabellose Headsets mit 2,4-GHz-Dongle haben weniger Verzögerung als Bluetooth.", "Ein abnehmbares Mikrofon ist praktisch, wenn du das Headset auch unterwegs nutzt.", "Für PS5 und Switch auf Kompatibilität achten.", "Ohrpolster aus Stoff sind bei langen Sessions angenehmer als Kunstleder."]);
const P = (slug, kw, h, re, o, intro) => t(slug, kw, h, re, { ...o, price: true }, intro, ["Ein hoher Rabatt allein sagt wenig: Wir vergleichen mit dem Preisverlauf, nicht nur mit der UVP.", "Lieferkosten und Rückgaberecht des Shops beachten.", "Setz einen Preisalarm, wenn dein Wunschprodukt noch nicht günstig genug ist."]);
P("deals-unter-10-euro", "Deals unter 10 Euro", "Deals unter 10 Euro", ".", { max: 10, group: "preis" }, "Kleine Preise, echte Rabatte: alle geprüften Deals bis 10 Euro auf einen Blick.");
P("deals-unter-20-euro", "Deals unter 20 Euro", "Deals unter 20 Euro", ".", { max: 20, group: "preis" }, "Alle geprüften Deals bis 20 Euro, ideal für Mitbringsel und Wichtelgeschenke.");
P("deals-unter-50-euro", "Deals unter 50 Euro", "Deals unter 50 Euro", ".", { max: 50, group: "preis" }, "Alle geprüften Deals bis 50 Euro, von Technik-Zubehör bis Küchenhelfer.");
P("deals-unter-100-euro", "Deals unter 100 Euro", "Deals unter 100 Euro", ".", { max: 100, group: "preis" }, "Alle geprüften Deals bis 100 Euro: Kopfhörer, Smart Home, Küche und mehr.");
P("fernseher-unter-500-euro", "Fernseher unter 500 Euro", "Fernseher unter 500 Euro", "Fernseher|Smart-TV|QLED|Mini-LED-Fern", { max: 500, cat: "tv", group: "preis" }, "Günstige Fernseher bis 500 Euro mit geprüftem Rabatt.");
P("fernseher-unter-1000-euro", "Fernseher unter 1000 Euro", "Fernseher unter 1000 Euro", "Fernseher|Smart-TV|QLED|Mini-LED-Fern", { max: 1000, cat: "tv", group: "preis" }, "OLED, QLED und Mini-LED bis 1000 Euro: alle geprüften TV-Deals in diesem Budget.");
P("kopfhoerer-unter-50-euro", "Kopfhörer unter 50 Euro", "Kopfhörer unter 50 Euro", "Kopfhörer|Earbuds|In-Ears|AirPods", { max: 50, group: "preis" }, "Günstige Kopfhörer bis 50 Euro, In-Ear und Over-Ear.");
P("kopfhoerer-unter-100-euro", "Kopfhörer unter 100 Euro", "Kopfhörer unter 100 Euro", "Kopfhörer|Earbuds|In-Ears|AirPods", { max: 100, group: "preis", best: "beste-kopfhoerer-unter-100-euro" }, "Kopfhörer bis 100 Euro, auch mit Noise Cancelling.");
P("laptop-unter-500-euro", "Laptop unter 500 Euro", "Laptops unter 500 Euro", "Laptop|Notebook|OmniBook", { max: 500, group: "preis" }, "Günstige Laptops bis 500 Euro für Schule, Studium und Büro.");
P("laptop-unter-1000-euro", "Laptop unter 1000 Euro", "Laptops unter 1000 Euro", "Laptop|Notebook|OmniBook", { max: 1000, group: "preis" }, "Laptops bis 1000 Euro, inklusive Gaming-Einsteiger.");
P("monitor-unter-200-euro", "Monitor unter 200 Euro", "Monitore unter 200 Euro", "Monitor", { max: 200, group: "preis" }, "Günstige Monitore bis 200 Euro für Büro und Homeoffice.");
P("monitor-unter-500-euro", "Monitor unter 500 Euro", "Monitore unter 500 Euro", "Monitor", { max: 500, group: "preis" }, "Monitore bis 500 Euro, inklusive Gaming und WQHD.");
P("saugroboter-unter-300-euro", "Saugroboter unter 300 Euro", "Saugroboter unter 300 Euro", "Saugroboter|Saug- und Wisch|Roomba|DEEBOT", { max: 300, group: "preis", best: "beste-saugroboter" }, "Saugroboter bis 300 Euro, viele davon mit Laser-Navigation.");
P("smartphone-unter-300-euro", "Handy unter 300 Euro", "Smartphones unter 300 Euro", "Smartphone|Galaxy A|POCO|moto|Moto G|Pixel", { max: 300, cat: "phone", group: "preis" }, "Günstige Handys ohne Vertrag bis 300 Euro.");
P("smartwatch-unter-200-euro", "Smartwatch unter 200 Euro", "Smartwatches unter 200 Euro", "Watch|Amazfit", { max: 200, cat: "watch", group: "preis" }, "Smartwatches und Fitnessuhren bis 200 Euro.");
P("lego-unter-50-euro", "LEGO unter 50 Euro", "LEGO-Sets unter 50 Euro", "LEGO", { max: 50, group: "preis", art: "lego-angebote" }, "LEGO-Sets bis 50 Euro, ideal als Geschenk.");
P("waschmaschine-unter-500-euro", "Waschmaschine unter 500 Euro", "Waschmaschinen unter 500 Euro", "Waschmaschine|Toplader", { max: 500, group: "preis", art: "waschmaschine-trockner-angebote" }, "Waschmaschinen bis 500 Euro mit geprüftem Rabatt.");
P("saugroboter-unter-200-euro", "Saugroboter unter 200 Euro", "Saugroboter unter 200 Euro", "Saugroboter|Saug- und Wisch|Roomba|DEEBOT", { max: 200, group: "preis", best: "beste-saugroboter" }, "Günstige Saugroboter bis 200 Euro mit geprüftem Rabatt, ideal für kleinere Wohnungen.");
P("saugroboter-unter-500-euro", "Saugroboter unter 500 Euro", "Saugroboter unter 500 Euro", "Saugroboter|Saug- und Wisch|Roomba|DEEBOT", { max: 500, group: "preis", best: "beste-saugroboter" }, "Saugroboter bis 500 Euro, oft schon mit Wischfunktion und Absaugstation.");
P("saug-wischroboter-unter-500-euro", "Saug-Wischroboter unter 500 Euro", "Saug- und Wischroboter unter 500 Euro", "Saug- und Wisch|Wischroboter|Wischfunktion|Omni|Ultra", { max: 500, group: "preis", best: "beste-saugroboter" }, "Saug- und Wischroboter bis 500 Euro mit geprüftem Rabatt.");
P("heissluftfritteuse-unter-100-euro", "Heißluftfritteuse unter 100 Euro", "Heißluftfritteusen unter 100 Euro", "Heißluftfritteuse|Airfryer|Air Fryer|Heissluftfritteuse", { max: 100, group: "preis", best: "beste-heissluftfritteuse" }, "Heißluftfritteusen bis 100 Euro, auch mit zwei Kammern.");
P("akkusauger-unter-300-euro", "Akkusauger unter 300 Euro", "Akkusauger unter 300 Euro", "Akku-Staubsauger|Akkusauger|Akku-Handstaubsauger|kabelloser Staubsauger|Stabstaubsauger", { max: 300, group: "preis" }, "Akku- und Handstaubsauger bis 300 Euro mit geprüftem Rabatt.");
P("gaming-monitor-unter-300-euro", "Gaming-Monitor unter 300 Euro", "Gaming-Monitore unter 300 Euro", "Gaming-Monitor|144 Hz|165 Hz|180 Hz|240 Hz", { max: 300, group: "preis" }, "Schnelle Gaming-Monitore bis 300 Euro, von Full HD bis WQHD.");
P("ps5-spiele-unter-30-euro", "PS5-Spiele unter 30 Euro", "PS5-Spiele unter 30 Euro", "PS5|PlayStation 5", { max: 30, group: "preis" }, "PS5-Spiele bis 30 Euro, viele davon weit unter der UVP.");
P("deals-unter-30-euro", "Deals unter 30 Euro", "Deals unter 30 Euro", ".", { max: 30, group: "preis" }, "Alle geprüften Deals bis 30 Euro, ideal für Wichtel- und Nikolausgeschenke.");
P("kuechenmaschine-unter-300-euro", "Küchenmaschine unter 300 Euro", "Küchenmaschinen unter 300 Euro", "Küchenmaschine|MUM5|MUMS|Kenwood|KitchenAid", { max: 300, group: "preis" }, "Küchenmaschinen bis 300 Euro mit geprüftem Rabatt.");
P("drucker-unter-200-euro", "Drucker unter 200 Euro", "Drucker unter 200 Euro", "Drucker|DeskJet|LaserJet|PIXMA|Smart Tank|EcoTank|OfficeJet", { max: 200, group: "preis" }, "Tinten- und Laserdrucker bis 200 Euro mit geprüftem Rabatt.");
P("kaffeevollautomat-unter-500-euro", "Kaffeevollautomat unter 500 Euro", "Kaffeevollautomaten unter 500 Euro", "Kaffeevollautomat|ECAM|Magnifica|Dinamica|Krups", { max: 500, group: "preis", best: "bester-kaffeevollautomat" }, "Kaffeevollautomaten bis 500 Euro mit geprüftem Rabatt, auch mit Milchsystem.");
P("pokemon-unter-30-euro", "Pokémon unter 30 Euro", "Pokémon-Produkte unter 30 Euro", "Pokémon", { max: 30, group: "preis" }, "Pokémon-Decks, Boxen und Spiele bis 30 Euro, ideal als Geschenk.");
P("lego-unter-30-euro", "LEGO unter 30 Euro", "LEGO-Sets unter 30 Euro", "LEGO", { max: 30, group: "preis", art: "lego-angebote" }, "LEGO-Sets bis 30 Euro, perfekt für Nikolaus und als Mitbringsel.");
P("playmobil-unter-30-euro", "PLAYMOBIL unter 30 Euro", "PLAYMOBIL-Sets unter 30 Euro", "PLAYMOBIL", { max: 30, group: "preis" }, "PLAYMOBIL-Sets bis 30 Euro, ideal als Mitbringsel, für Nikolaus und zum Wichteln.");
P("luftreiniger-unter-150-euro", "Luftreiniger unter 150 Euro", "Luftreiniger unter 150 Euro", "Luftreiniger|Air Purifier|Core 300|PureProtect", { max: 150, group: "preis" }, "Luftreiniger bis 150 Euro mit geprüftem Rabatt für Schlaf- und Wohnzimmer.");
P("kopfhoerer-unter-30-euro", "Kopfhörer unter 30 Euro", "Kopfhörer unter 30 Euro", "Kopfhörer|Earbuds|In-Ears|Headset", { max: 30, group: "preis" }, "Günstige Kopfhörer und Headsets bis 30 Euro.");
P("deals-ueber-50-prozent", "Deals über 50 Prozent", "Deals mit über 50 Prozent Rabatt", ".", { minPct: 50, group: "preis" }, "Die dicksten Rabatte: alle geprüften Deals mit mindestens 50 Prozent gegenüber dem Vergleichspreis.");

fs.writeFileSync("src/data/topics.json", JSON.stringify(T, null, 1) + "\n");
console.log(T.length, "Themen");
