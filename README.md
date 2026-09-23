# DWD Raster Explorer

**Webanwendung:** <https://dwd-raster-explorer.onrender.com>

Lokales Kartenwerkzeug zum Öffnen, Vergleichen und punktweisen Auslesen von ESRI-ASCII-Rastern (`.asc` und `.asc.gz`). Es kann lokale Dateien per Drag-and-drop laden und Raster direkt aus dem DWD-Open-Data-Verzeichnis importieren.

Beim Öffnen lädt die Anwendung automatisch das DWD-Raster der durchschnittlichen Tageshöchsttemperatur für Januar 1901 sowie das Jahresraster 1901. Das Januar-Raster ist auf der Karte sichtbar. So sind Karte, Legende und Punktabfrage sofort nutzbar.

**macOS: Zum Starten `Raster Explorer starten.command` doppelklicken.** Das Skript startet den lokalen Server auf einem freien Port und öffnet die fertige Oberfläche im Browser. Das Terminalfenster während der Nutzung geöffnet lassen. `templates/index.html` ist eine Flask-Vorlage und funktioniert beim direkten Öffnen als Datei nicht.

## Als Webseite über GitHub bereitstellen

GitHub Pages allein kann dieses Projekt nicht ausführen, weil die Anwendung einen
Python/Flask-Server benötigt. Das beiliegende `render.yaml` richtet diesen Server
bei Render ein und verbindet ihn mit dem GitHub-Repository.

1. Diesen Projektordner in ein GitHub-Repository hochladen.
2. Bei [Render](https://dashboard.render.com/) anmelden und **New → Blueprint** wählen.
3. Das GitHub-Repository verbinden und die Einrichtung bestätigen.
4. Nach dem ersten Build die angezeigte Adresse
   `https://dwd-raster-explorer-….onrender.com` öffnen und als Lesezeichen speichern.

Bei einer Verbindung über die Render-GitHub-App werden weitere Änderungen am
GitHub-Zweig automatisch veröffentlicht. Wird das öffentliche Repository nur
über seine URL eingebunden, muss anschließend in Render ein neues Deployment
gestartet werden.
Beim kostenlosen Render-Tarif schläft der Server nach längerer Inaktivität ein;
der erste Aufruf kann deshalb ungefähr eine Minute benötigen. Geladene Raster
liegen nur im Arbeitsspeicher und müssen nach einem Neustart erneut geladen werden.

## Funktionen

- mehrere Raster gleichzeitig laden und ein-/ausblenden
- farbige Rasterdarstellung mit Legende, Wertebereich und Deckkraft
- Wertabfrage beim Überfahren und Anklicken der Karte
- Ortssuche nach Stadt oder Postleitzahl direkt auf der Karte; ein Treffer setzt den Auswahlpunkt
- neue Raster erscheinen sofort in der Wertetabelle des bereits ausgewählten Punkts
- Zeitreihe aller geladenen Raster für einen Kartenpunkt
- Monatsverlauf per Jahr laden: alle verfügbaren Monate eines DWD-Parameters werden gemeinsam importiert und im Diagramm dargestellt
- Diagrammparameter unabhängig von der sichtbaren Kartenebene auswählen
- Klimadiagramm unter der Punktabfrage mit frei wählbaren Parametern und Monaten; Temperatur als Linie und Niederschlag als Balken mit getrennten Achsen
- weltweite Klimadiagramme ab 1950 für jeden gewählten Ort mit ERA5-Daten von Open-Meteo (etwa 25 km Auflösung)
- Reprojektion projizierter Raster in die Web-Mercator-Kartenprojektion
- geführter DWD-Katalog: Zeitauflösung, Parameter, gegebenenfalls Monat und Jahr wählen; die Verzeichnisse werden live abgefragt
- DWD-Verzeichnisse bei Bedarf auch manuell durchsuchen und ausgewählte Dateien laden
- einzelne DWD-`.asc.gz`-Dateien direkt per URL laden
- automatische Erkennung häufiger Koordinatensysteme sowie manuelle Auswahl
- verständliche DWD-Parameter, Zeiträume und Einheiten mit Link zur jeweiligen Datensatzbeschreibung anzeigen

Für DWD-Raster unter `CDC/grids_germany` liest das Tool die Zeitcodes `01`–`12` als Monate, `13`–`16` als Jahreszeiten und `17` als Gesamtjahr. Bei Dateien, die per DWD-URL importiert werden, liest es nach Möglichkeit die zugehörige PDF-Datensatzbeschreibung aus. Es übernimmt den beschriebenen Parameter und rechnet Werte nur bei eindeutig dokumentierter Einheit um. Andernfalls zeigt es die Originalwerte und verlinkt die Produktbeschreibung. Der allgemeine ESRI-ASCII-Import für `.asc` und `.asc.gz` bleibt verfügbar.

Für den normalen DWD-Import links im **DWD-Datenkatalog** die Zeitauflösung und den Parameter auswählen. Das Tool zeigt danach nur die vorhandenen Unterordner und Rasterdateien an. Bei Monatsrastern einen Monat und dann unter **Datensatz / Jahr** den Jahrgang wählen. Anschließend **Ausgewähltes Raster laden** anklicken. Für den Katalog und den Download ist eine Internetverbindung nötig.

Für einen Temperaturverlauf **Monat** und beispielsweise **Durchschnittliche Tageshöchsttemperatur** wählen. Unter **Jahr für Monatsverlauf** den Jahrgang einstellen und **Alle Monate für Diagramm laden** anklicken. Danach auf der Karte einen Ort suchen oder anklicken. Im Diagramm erscheinen die Monatswerte für diesen Punkt; mit **Diagrammparameter** kannst du zwischen geladenen Parametern wechseln. Auf der Karte bleibt jeweils nur der zuletzt geladene Monat dieser Reihe sichtbar.

Unter der Punktabfrage findest du das **Klimadiagramm**. Dort kannst du weitere DWD-Monatsparameter und ein Jahr direkt laden. Die Tabelle zeigt für jeden geladenen Parameter die Werte von Januar bis Dezember am gewählten Ort. Im Bereich **Parameter im Klimadiagramm** kannst du mehrere Parameter gleichzeitig anhaken; **Alle auswählen** aktiviert sämtliche geladenen Reihen. Die Häkchen links in der Tabelle sind mit dieser Auswahl verbunden. Über die Häkchen in den Monatsköpfen wählst du einzelne Monate; **Alle Monate anzeigen** im Tabellenkopf schaltet das ganze Jahr ein oder aus. Eine zusätzliche Jahresauswahl erscheint nur, wenn Monatsdaten aus mehreren Jahren geladen sind. In der Spalte **Darstellung** entscheidest du zwischen Linie und Balken. Temperatur (°C) und Niederschlag (mm) erhalten getrennte Achsen. Nicht geladene Monate bleiben als Lücke sichtbar.

Für Orte außerhalb Deutschlands im Klimadiagramm die Datenquelle **Weltweit · ERA5**
wählen. Danach lassen sich mittlere, höchste und tiefste Temperatur, Niederschlag,
Sonnenscheindauer, Globalstrahlung, Referenzverdunstung und Wind für vollständige
Jahre ab 1950 laden. Die Werte sind modellgestützte Reanalysedaten für eine
Rasterzelle von ungefähr 25 km und keine Messung direkt am angeklickten Punkt.
Zusätzlich erzeugt das Tool für den gewählten Kartenmonat eine farbige ERA5-Ebene
über dem aktuell sichtbaren Kartenausschnitt. Nach dem Wechsel in eine andere
Weltregion die Daten erneut laden, damit die Farbfläche für diesen Ausschnitt
berechnet wird.

## Installation in Visual Studio Code

1. Den Projektordner in VS Code öffnen.
2. In VS Code **Terminal → Neues Terminal** wählen.
3. Virtuelle Umgebung erstellen:

   **macOS/Linux**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```

   **Windows PowerShell**

   ```powershell
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   py app.py
   ```

4. Im Browser `http://127.0.0.1:5000` öffnen.

## Koordinatensysteme

Das ESRI-ASCII-Format enthält gewöhnlich keinen CRS-Code. Das Tool erkennt derzeit:

- geografische Koordinaten: EPSG:4326
- DHDN / Gauß-Krüger Zone 3: EPSG:31467
- ETRS89 / LAEA Europe: EPSG:3035
- ETRS89 / UTM Zone 32N: EPSG:25832

Ist die automatische Erkennung nicht eindeutig, wird die Datei nicht auf Verdacht positioniert. Dann vor dem Import das korrekte Koordinatensystem auswählen. Für ein unbekanntes DWD-Produkt ist die Projektion anhand seiner Produktbeschreibung zu prüfen.

## Hinweise

- Die Hintergrundkarte benötigt eine Internetverbindung. Raster, Kartensteuerung und Diagramm funktionieren mit den lokal mitgelieferten Bibliotheken auch ohne erreichbares CDN.
- Die Ortssuche verwendet weltweit die Geocoding-API von Open-Meteo mit Ortsdaten von GeoNames und benötigt eine Internetverbindung. Globale historische Klimadaten stammen aus Open-Meteo/ERA5 und stehen in der kostenlosen API nur für nicht kommerzielle Nutzung unter CC BY 4.0 bereit.
- Die Raster bleiben nur während der laufenden Programmsitzung im Arbeitsspeicher.
- Der Direktimport akzeptiert aus Sicherheitsgründen ausschließlich Dateien unter `https://opendata.dwd.de/climate_environment/`.
- Bei vielen großen Rastern steigt der Arbeitsspeicherbedarf entsprechend an.

## Datenquelle

DWD Climate Data Center: <https://opendata.dwd.de/climate_environment/CDC/grids_germany/>
