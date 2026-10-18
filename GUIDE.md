# Bankboken: så kommer du igång

Appen består av två delar, precis som Middagsboken:

- **Supabase** är databasen. Där sparas budgetarna och där finns inloggningarna.
- **GitHub Pages** är webbadressen där appen ligger, till exempel `https://dittnamn.github.io/hushallskassan`.

Varje person som loggar in har sin **egen** budget. Ingen annan kan se den.

Båda tjänsterna är gratis. Du gör stegen nedan en gång, och resten sköter Claude.

---

## Del 1: Databasen (Supabase), cirka 10 minuter

1. Gå till **supabase.com** och logga in med samma konto som för Middagsboken.
2. Tryck **New project**:
   - Name: `hushallskassan`
   - Database Password: välj ett lösenord och spara det någonstans. Appen behöver det inte.
   - Region: **North EU (Stockholm)**
   - Tryck **Create new project** och vänta ett par minuter.
3. Välj **SQL Editor** i menyn till vänster och tryck **New query**.
   Öppna filen `supabase-setup.sql`, kopiera **allt** innehåll, klistra in det och tryck **Run**. Det ska stå "Success".
4. Välj **Authentication**, sedan **Users**, **Add user** och **Create new user**:
   - Fyll i e-post och lösenord.
   - Kryssa i **Auto Confirm User**.
   - Upprepa för varje person som ska ha en egen budget.
5. Välj **Authentication** och sedan **Sign In / Providers**. Stäng av **Allow new users to sign up**, så kan ingen utomstående skapa ett konto.
6. Gå till **Project Settings** (kugghjulet) och välj **API** eller **API Keys**. Kopiera:
   - **Project URL**, till exempel `https://abcdefgh.supabase.co`
   - **anon public**-nyckeln eller **Publishable key**

   Skicka båda till Claude. Den nyckeln är gjord för att ligga i appen och är inte hemlig. Skicka **aldrig** nyckeln som heter `service_role` eller "Secret key".

> Gratisplanen hos Supabase tillåter två aktiva projekt. Middagsboken och Bankboken blir de två.

## Del 2: Webbadressen (GitHub), cirka 5 minuter

1. Gå till **github.com**, tryck **+** uppe till höger och välj **New repository**:
   - Repository name: `hushallskassan`
   - Välj **Public**. Det krävs för gratis GitHub Pages. Koden syns då, men inte din budget, eftersom den ligger bakom inloggningen.
   - Tryck **Create repository**.
2. Säg till Claude att det är klart. Claude laddar upp appen.
3. Gå till repositoryt och välj **Settings** och sedan **Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** och **/ (root)**, tryck **Save**.
   - Efter ungefär en minut visas adressen överst, till exempel `https://dittnamn.github.io/hushallskassan/`.
4. Gå tillbaka till Supabase och välj **Authentication** och **URL Configuration**. Klistra in adressen i **Site URL** och tryck **Save**. Då fungerar "Glömt lösenordet?".

## Del 3: Installera på iPhone

1. Öppna adressen i **Safari**.
2. Tryck på **Dela** och välj **Lägg till på hemskärmen**.
3. Öppna appen från hemskärmen och logga in.

---

## Bra att veta

- **Utan internet:** appen öppnas ändå och visar det som senast hämtades. Det du ändrar sparas när telefonen är online igen.
- **Flera enheter:** ändrar du på telefonen syns det direkt på datorn, och tvärtom.
- **Lönedagen:** under Inställningar kan budgetmånaden börja den 25:e i stället för den 1:a.
- **Byta lösenord och logga ut:** längst ner under Inställningar.
- **Kostnad:** 0 kr. Supabase pausar gratisprojekt som inte har använts på 7 dagar. Du startar det igen med ett klick på supabase.com, och ingen data försvinner.
