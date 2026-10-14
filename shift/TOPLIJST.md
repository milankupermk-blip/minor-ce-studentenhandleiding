# Gedeelde toplijst aanzetten

Zonder instellingen toont SHIFT alleen de scores op het eigen apparaat. Voor één toplijst voor iedereen heb je een gratis Firebase-project nodig (Spark-plan, geen betaalgegevens nodig). Dat kost ongeveer tien minuten.

1. Ga naar <https://console.firebase.google.com> en log in met je Google-account.
2. Kies **Project toevoegen**, bijvoorbeeld met de naam `shift-toplijst`. Google Analytics heb je niet nodig.
3. Open **Build → Firestore Database → Database maken**. Kies de **productiemodus** en een Europese locatie, zoals `eur3`.
4. Open het tabblad **Regels**, vervang de inhoud door die van [`firestore.rules`](firestore.rules) en kies **Publiceren**.
5. Open **Projectinstellingen** (tandwiel) → **Je apps** → het web-icoon `</>`. Registreer een app en kopieer `apiKey` en `projectId`.
6. Vul die waarden in [`leaderboard-config.js`](leaderboard-config.js) in:

   ```js
   export const LEADERBOARD = {apiKey: 'AIza…', projectId: 'shift-toplijst', collection: 'shift_scores'};
   ```

7. Commit en push. Na een minuut staat de gedeelde toplijst online.

De `apiKey` van een Firebase-webapp is geen geheim: die mag in openbare code staan. De beveiliging zit in de regels. Iedereen mag scores lezen en toevoegen, maar niemand mag iets wijzigen of verwijderen. De regels controleren ook de naam, of elke rondescore tussen 0 en 120 ligt, en of het totaal klopt. Wil je extra zekerheid, beperk de sleutel dan in Google Cloud tot het adres `milankupermk-blip.github.io`.

**Beperking:** de score wordt in de browser berekend. Wie technisch handig is, kan dus een nep-score insturen die binnen de regels valt. Helemaal waterdicht wordt het alleen met een server die het spel zelf naspeelt. Dat vraagt een betaald plan (Cloud Functions) en is voor een leerspel meestal niet nodig. Een verkeerde score verwijder je zelf in de Firebase-console.
