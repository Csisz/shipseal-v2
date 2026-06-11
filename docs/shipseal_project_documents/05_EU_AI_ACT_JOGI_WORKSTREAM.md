# 05 - EU AI Act és jogi workstream

## Cél

A ShipSeal EU AI Act modulja ne legyen jogi tanácsadó eszköz. A cél egy olyan előszűrő és dokumentáció-előkészítő funkció, amely segít AI fejlesztőknek és ügynökségeknek rendezni a kérdéseket, amelyeket egy jogász vagy compliance szakértő később ellenőrizhet.

A feleség jogi szakértelme itt komoly előny lehet, de a termékben és marketingben óvatosan kell fogalmazni.

## Ajánlott jogi pozicionálás

### Kerülendő állítások

- „AI Act compliant minősítést adunk.”
- „Jogi megfelelőséget igazolunk.”
- „Megmondjuk, hogy high-risk-e a rendszered jogilag.”
- „Kiváltjuk a jogi tanácsadást.”

### Használható állítások

- „AI Act readiness előszűrést készítünk.”
- „Összegyűjtjük a jogi review-hoz szükséges technikai és működési információkat.”
- „Transparency / disclosure javaslatokat készítünk.”
- „Kérdéslistát adunk jogi ellenőrzéshez.”
- „Nem jogi tanácsadás, hanem fejlesztői és termékoldali felkészültségi riport.”

## Mit kell a jogi workstreamben tisztázni?

### 1. Szerepkörök

- Provider, deployer, importer, distributor fogalmak gyakorlati különbsége.
- Egy AI freelancer vagy ügynökség mikor provider?
- Az ügyfél mikor deployer?
- White-label fejlesztésnél ki milyen szerepet viselhet?
- Magyar KKV-k esetén milyen tipikus szerződéses helyzetek vannak?

### 2. Kockázati kategóriák

- Tiltott AI gyakorlatok rövid, fejlesztőbarát magyarázata.
- High-risk előszűrés Annex III témák alapján.
- Mely use case-eket kell MVP-ben automatikusan „legal review required” jelzéssel ellátni?
- Mikor lehet „minimal/limited risk” irányban kommunikálni?

### 3. Transparency / Article 50

A 2026. májusi European Commission draft guidance alapján a transparency kötelezettségek különösen fontosak lehetnek. Tisztázandó:

- Mikor kell jelezni, hogy a felhasználó AI rendszerrel beszél?
- Milyen chatbot disclosure szöveg legyen ajánlott?
- Mikor kell AI-generált tartalmat jelölni?
- Mikor kell deepfake vagy manipulált tartalom disclosure?
- Milyen „first interaction” / „first exposure” szövegek legyenek?
- Magyar nyelvű mintaszövegek hogyan hangozzanak?

### 4. Emberi felügyelet

- Mit jelenthet low-risk / limited-risk appoknál az emberi ellenőrzés?
- Milyen döntéseket nem hozhat az AI önállóan?
- Milyen területeken kell automatikus „human review required” jelzés?
- Hogyan fogalmazzuk meg ezt ügyfélátadási riportban?

### 5. Adatvédelem / GDPR kapcsolódás

Bár ez nem csak AI Act kérdés, a terméknek kérdeznie kell:

- kezel-e személyes adatot,
- kezel-e különleges adatot,
- kerül-e adat külső AI providerhez,
- van-e adatfeldolgozói viszony,
- van-e törlési és retention policy,
- van-e naplózás,
- van-e adatminimalizálás.

### 6. Szerződéses és felelősségi keretek

- Mit vállalhat egy AI ügynökség az ügyfél felé?
- Mit nem szabad ígérnie?
- Milyen átadási disclaimer szükséges?
- Hogyan jelöljük, hogy a riport pillanatfelvétel?
- Hogyan kezeljük, hogy a jog változhat?

## Feleség / jogász által segíthető konkrét feladatok

### A. Terméknyelvezet ellenőrzése

Ellenőrizze:

- landing page állításait,
- pricing oldal állításait,
- report disclaimereket,
- „not legal advice” megfogalmazást,
- magyar és angol kockázati figyelmeztetéseket.

### B. AI Act kérdőív review

Segítsen kialakítani:

- provider/deployer kérdéssort,
- high-risk előszűrő kérdéssort,
- Article 50 transparency kérdéseket,
- human oversight kérdéseket,
- legal review required trigger pontokat.

### C. Mintaszövegek

Készíthet / ellenőrizhet:

- chatbot disclosure magyarul,
- chatbot disclosure angolul,
- AI-generated content jelölési szöveg,
- ügyfélátadási disclaimer,
- report footer disclaimer,
- Terms / privacy alap-szöveg váz.

### D. Red flag lista

Segíthet meghatározni, mikor jelezzen a rendszer:

- „legal review strongly recommended”,
- „do not ship before legal review”,
- „high-risk possibility”,
- „transparency notice missing”,
- „personal data handling unclear”.

### E. Magyar piaci sajátosságok

Értelmezheti:

- magyar KKV-k számára milyen kommunikáció érthető,
- hogyan kerülhető el a jogi tanácsadás látszata,
- milyen felelősségi kizárások szükségesek,
- milyen szerződéses modell javasolt founder-reviewed auditoknál.

## Jogi inputból készülő ShipSeal outputok

### `AI_ACT_READINESS_CHECKLIST.md`

Tartalom:

- alkalmazás célja,
- szerepkörök,
- felhasználói kör,
- kezelt adatok,
- kockázati előszűrés,
- transparency kérdések,
- human oversight,
- legal review triggers.

### `TRANSPARENCY_NOTICE_DRAFT.md`

Tartalom:

- rövid disclosure,
- bővebb disclosure,
- chatbot kezdőüzenet,
- footer / help page szöveg,
- AI-generated content jelölési sablon.

### `LEGAL_REVIEW_QUESTIONS.md`

Tartalom:

- jogásznak átadandó kérdések,
- tisztázandó szerepkörök,
- ügyféloldali döntések,
- szerződéses felelősség,
- adatvédelmi hiányok.

### `CLIENT_HANDOFF_LEGAL_NOTES.md`

Tartalom:

- mit vizsgáltunk,
- mit nem vizsgáltunk,
- mihez kell jogi review,
- milyen ismert korlátok vannak.

## Javasolt disclaimer sablon

> Ez a riport technikai, termékoldali és előzetes AI Act readiness elemzés. Nem minősül jogi tanácsadásnak, jogi szakvéleménynek vagy hatósági megfelelőségi igazolásnak. A riport célja, hogy összegyűjtse az AI-rendszerrel kapcsolatos főbb kockázati, átláthatósági, emberi felügyeleti és dokumentációs kérdéseket, amelyeket szükség esetén jogi szakértővel kell ellenőriztetni.

Angol változat:

> This report is a technical, product and preliminary AI Act readiness assessment. It does not constitute legal advice, a legal opinion or a formal compliance certification. Its purpose is to organize the main risk, transparency, human oversight and documentation questions related to the AI system so they can be reviewed by a qualified legal professional where necessary.

## Első jogi sprint feladatai

1. AI Act role/risk kérdőív első változatának ellenőrzése.
2. Transparency notice sablonok megírása magyarul és angolul.
3. „Not legal advice” és report disclaimer jóváhagyása.
4. High-risk red flag trigger lista készítése.
5. Founder-reviewed audit szerződéses keretének előzetes vázlata.

## Hivatkozási alapok

A stratégia az alábbi, nyilvános és aktuális technológiai/jogi irányokra épít:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. május: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyílt formátum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentáció: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentáció: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentáció: https://modelcontextprotocol.io/docs/getting-started/intro

Megjegyzés: az EU AI Act értelmezési részek nem minősülnek jogi tanácsadásnak. A termék kommunikációjában is ezt kell következetesen feltüntetni: előszűrés, readiness, dokumentáció-előkészítés és technikai/jogi kérdéslista készül, nem jogi szakvélemény.