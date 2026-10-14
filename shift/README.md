# SHIFT

Mobiele quiz over de kennis en ontwikkelingen die iedereen die professioneel aan duurzaamheid werkt zou moeten kennen. Niveau: basis tot gevorderd, met de stand van zaken van oktober 2026.

## Spelen

Op het startscherm kies je **Solo** of **Multiplayer**. Elk potje bestaat uit vijf rondes van elk maximaal 120 punten, samen 600:

1. **KennisSprint**: drie meerkeuzevragen en drie vragen waarbij je het begrip typt.
2. **Open Deur**: vind vijf begrippen bij een onderwerp.
3. **Verbandenpuzzel**: twaalf kaarten in drie groepen van vier, met bewuste misleiders. Een juiste groep levert de helft van de punten op, het juiste verband benoemen de andere helft.
4. **Connectie**: koppel zes begrippen aan hun omschrijving.
5. **Finale**: noem zo veel mogelijk antwoorden per vraag; elk antwoord is 8 punten waard. Je kunt passen naar de volgende vraag.

- **Solo**: je score kan op de toplijst. Zie [TOPLIJST.md](TOPLIJST.md) voor de gedeelde versie.
- **Multiplayer**: je speelt eerst zelf en deelt daarna een link. Je tegenstander krijgt via een gedeelde seed exact dezelfde vragen en stuurt de uitslag terug. Er is geen server nodig. Een controlegetal herkent links die met de hand zijn aangepast.

## Inhoud

Alle vragen staan in [`vragen.js`](vragen.js), verdeeld over acht onderwerpen:

- klimaat en CO₂
- wet- en regelgeving (CSRD na de Omnibus, CSDDD, taxonomie, CBAM, ETS2, de nieuwe EU-regels tegen misleidende groene claims, PPWR, productpaspoort)
- circulaire economie
- strategie en meten
- natuur en biodiversiteit
- mensen en keten
- communicatie en claims
- energietransitie

Bij meerkeuzevragen is het goede antwoord bewust niet het langste en verraadt de vraag het antwoord niet.

## Techniek

Statische site zonder buildstap. Werkt na de eerste keer laden ook offline via een service worker. De themamuziek is een eigen compositie die live wordt gemaakt met Web Audio.

Gebaseerd op het origineel van FabianB88: <https://github.com/FabianB88/shift>
