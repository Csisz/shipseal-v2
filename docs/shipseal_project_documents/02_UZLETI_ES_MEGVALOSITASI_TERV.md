# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# 02 - Ăśzleti Ă©s megvalĂłsĂ­tĂˇsi terv

## VezetĹ‘i Ă¶sszefoglalĂł

A ShipSeal cĂ©lja, hogy a gyorsan kĂ©szĂĽlĹ‘ AI-prototĂ­pusokbĂłl ĂĽgyfĂ©lnek ĂˇtadhatĂł, agent-ready Ă©s elĹ‘zetesen kockĂˇzatkezelt projektcsomagot kĂ©szĂ­tsen. A termĂ©k elsĹ‘dleges vevĹ‘i AI freelancerek Ă©s kis AI-ĂĽgynĂ¶ksĂ©gek, akik ĂĽgyfeleknek Ă©pĂ­tenek chatbotokat, RAG rendszereket, dokumentum-AI eszkĂ¶zĂ¶ket, belsĹ‘ asszisztenseket vagy no-code/low-code AI automatizĂˇciĂłkat.

Az elsĹ‘ ĂĽzleti cĂ©l nem nagyvĂˇllalati SaaS, hanem fizetĹ‘s, gyorsan validĂˇlhatĂł riport- Ă©s delivery-pack szolgĂˇltatĂˇs. A szoftver fokozatosan nĹ‘ ki ebbĹ‘l: elĹ‘szĂ¶r automatikus riportgenerĂˇtor, utĂˇna white-label ĂĽgynĂ¶ksĂ©gi csomag, majd kĂ©sĹ‘bb csapatdashboard, GitHub App, backend worker, fizetĂ©s, audit history Ă©s API.

## TermĂ©kpozicionĂˇlĂˇs

### RĂ¶vid ĂĽzenet

**MielĹ‘tt Ăˇtadod az AI-appodat, tedd agent-readyvĂ©, tesztelhetĹ‘vĂ© Ă©s dokumentĂˇltan ĂĽgyfĂ©lkĂ©pessĂ©.**

### Angol verziĂł

**Before you ship an AI app, seal it with an agent-ready delivery pack.**

### Mit nem mondunk?

- Nem mondjuk, hogy teljes jogi megfelelĹ‘sĂ©get igazolunk.
- Nem mondjuk, hogy high-risk jogi minĹ‘sĂ­tĂ©st adunk.
- Nem mondjuk, hogy production security auditot vĂ©gzĂĽnk.
- Nem mondjuk, hogy minden MCP szerver biztonsĂˇgosan generĂˇlhatĂł automatikusan.

### Mit mondunk?

- Readiness reportot adunk.
- FejlesztĂ©si Ă©s ĂˇtadĂˇsi dokumentĂˇciĂłt generĂˇlunk.
- Teszteseteket Ă©s red-team promptokat kĂ©szĂ­tĂĽnk.
- EU AI Act transparency Ă©s risk kĂ©rdĂ©sekhez elĹ‘zetes checklistet adunk.
- Jogi review-hoz elĹ‘kĂ©szĂ­tjĂĽk az informĂˇciĂłkat.

## Piaci hipotĂ©zis

Az AI freelancerek Ă©s kis ĂĽgynĂ¶ksĂ©gek egyre gyakrabban adnak Ăˇt AI-prototĂ­pusokat, de az ĂˇtadĂˇs minĹ‘sĂ©ge sokszor ad hoc. Ha a ShipSeal kĂ©pes 30-60 percnyi dokumentĂˇciĂłs Ă©s review munkĂˇt 5-10 percre csĂ¶kkenteni, valamint a kĂ©sz anyag ĂĽgyfĂ©l felĂ© professzionĂˇlisabbĂˇ teszi a szĂˇllĂ­tĂˇst, akkor a cĂ©lcsoport fizethet Ă©rte.

## ElsĹ‘ fizetĹ‘s ajĂˇnlat

### ShipSeal Delivery Report

Input:

- repo ZIP vagy GitHub URL,
- AI-app leĂ­rĂˇs,
- cĂ©lfelhasznĂˇlĂłk,
- promptok / system prompt,
- kezelt adatok,
- pĂ©lda outputok,
- ĂĽgyfĂ©lĂˇtadĂˇsi cĂ©l.

Output:

- ShipSeal score,
- `AGENTS.md`,
- `CLAUDE.md`,
- 3-5 `SKILL.md`,
- MCP governance pack,
- eval/red-team pack,
- EU AI Act readiness checklist,
- transparency notice draft,
- white-label client handoff report.

## ĂrazĂˇsi javaslat

| Csomag | Ăr | Tartalom | CĂ©l |
|---|---:|---|---|
| Free preview | 0 EUR | readiness preview, 5 javaslat, 5 teszteset | lead generĂˇlĂˇs |
| Starter report | 49 EUR | AGENTS.md, CLAUDE.md, 30 teszteset, mini AI Act checklist | elsĹ‘ fizetĹ‘s validĂˇciĂł |
| Pro agency report | 149 EUR | white-label report, skillek, red-team pack, MCP pack | AI ĂĽgynĂ¶ksĂ©gek |
| Founder-reviewed audit | 499-999 EUR | manuĂˇlis szakĂ©rtĹ‘i review + 60 perc konzultĂˇciĂł | elsĹ‘ komoly bevĂ©tel |

Magyar validĂˇciĂłs Ăˇrak:

| Csomag | Ăr |
|---|---:|
| ElsĹ‘ riport | 19 900 Ft |
| White-label riport | 79 000 Ft |
| Founder-reviewed audit | 149 000-299 000 Ft |

## 30/60/90 napos megvalĂłsĂ­tĂˇsi terv

### ElsĹ‘ 30 nap - fizetĹ‘s validĂˇciĂłra alkalmas csomag

Feladatok:

1. Ăšj repo lĂ©trehozĂˇsa az egysĂ©ges ShipSeal irĂˇnyhoz.
2. A meglĂ©vĹ‘ agentready-hub frontend ShipSeal irĂˇnyĂş megtisztĂ­tĂˇsa Ă©s Ăşj pozicionĂˇlĂˇsa.
3. Az elsĹ‘ output-specifikĂˇciĂł vĂ©glegesĂ­tĂ©se.
4. Statikus / fĂ©lautomata ShipSeal Delivery Report generĂˇlĂˇsa.
5. Minta riport kĂ©szĂ­tĂ©se 1-2 sajĂˇt AI-projekt alapjĂˇn.
6. Landing page + fizetĂ©si Ă©rdeklĹ‘dĂ©si CTA.
7. 20-30 cĂ©lzott megkeresĂ©s AI freelancereknek / kis ĂĽgynĂ¶ksĂ©geknek.

30. napi mĂ©rĹ‘szĂˇmok:

- 1 mĹ±kĂ¶dĹ‘ demo,
- 2 minta riport,
- 20 megkeresĂ©s,
- 5 komoly visszajelzĂ©s,
- legalĂˇbb 1 fizetĂ©si szĂˇndĂ©k vagy fizetĹ‘s pilot.

### 60 nap - mĹ±kĂ¶dĹ‘ MVP

Feladatok:

1. Repo scanner + intake form Ă¶sszekĂ¶tĂ©se.
2. `AGENTS.md`, `CLAUDE.md`, skillek Ă©s MCP pack generĂˇlĂˇs stabilizĂˇlĂˇsa.
3. PDF/Markdown report export.
4. AI2AI/VerdictMesh Review Council elsĹ‘ integrĂˇciĂłja: QA, security, compliance, skeptical customer, final judge.
5. EU AI Act readiness checklist elsĹ‘ verziĂłja jogi review-val.
6. White-label report sablon.

60. napi mĂ©rĹ‘szĂˇmok:

- 3 fizetĹ‘s riport vagy founder-reviewed audit,
- 1 ĂĽgynĂ¶ksĂ©gi partnerjelĂ¶lt,
- 5 letĂ¶ltĂ¶tt/Ăˇtadott report,
- egyĂ©rtelmĹ± visszajelzĂ©s arrĂłl, melyik modulĂ©rt fizetnĂ©nek.

### 90 nap - fizetĹ‘s pilot Ă©s termĂ©kdĂ¶ntĂ©s

Feladatok:

1. FizetĂ©si integrĂˇciĂł.
2. EgyszerĹ± account / report history.
3. Job queue vagy backend worker dĂ¶ntĂ©s elĹ‘kĂ©szĂ­tĂ©se.
4. GitHub public import stabilizĂˇlĂˇsa, private repo kĂ©sĹ‘bbre.
5. Pro csomag kiadĂˇsa 5-10 fizetĹ‘s ĂĽgyfĂ©lnek.
6. Roadmap dĂ¶ntĂ©s: agency report, EU AI Act readiness vagy TestBench legyen-e a vezetĹ‘ Ă©rtĂ©kajĂˇnlat.

90. napi mĂ©rĹ‘szĂˇmok:

- 5-10 fizetĹ‘ ĂĽgyfĂ©l vagy legalĂˇbb 1000 EUR bevĂ©teli validĂˇciĂł,
- 3 testimonial,
- legalĂˇbb 30% visszatĂ©rĹ‘ hasznĂˇlati szĂˇndĂ©k ĂĽgynĂ¶ksĂ©geknĂ©l,
- vilĂˇgos dĂ¶ntĂ©s a kĂ¶vetkezĹ‘ 3 hĂłnap fĂłkuszĂˇrĂłl.

## FejlesztĂ©si stratĂ©gia

### ElsĹ‘ elv

Nem teljes platformot Ă©pĂ­tĂĽnk, hanem ĂˇtadhatĂł outputot.

### MĂˇsodik elv

A readiness score determinisztikus Ă©s auditĂˇlhatĂł legyen. Az AI magyarĂˇzhat, gazdagĂ­that, javasolhat, de ne Ă­rja felĂĽl a kritikus blokkolĂłkat.

### Harmadik elv

A jogi modul mindig elĹ‘szĹ±rĂ©s. A termĂ©k jogi kĂ©rdĂ©slistĂˇt Ă©s dokumentĂˇciĂłs alapot kĂ©szĂ­t, nem jogi szakvĂ©lemĂ©nyt.

### Negyedik elv

A VerdictMesh multi-agent council csak ott fusson, ahol Ă©rtĂ©ket ad: go/no-go, compliance uncertainty, high-risk signal, ĂĽgyfĂ©lĂˇtadĂˇsi dĂ¶ntĂ©s.

## Ă‰rtĂ©kesĂ­tĂ©si terv

### ElsĹ‘ cĂ©lzott megkeresĂ©sek

- AI freelancerek LinkedInen,
- magyar Ă©s nemzetkĂ¶zi no-code/AI ĂĽgynĂ¶ksĂ©gek,
- AI automatizĂˇciĂłs tanĂˇcsadĂłk,
- indie SaaS fejlesztĹ‘k,
- AI workshop oktatĂłk.

### TesztkĂ©rdĂ©sek

- AdtĂˇl mĂˇr Ăˇt AI-appot ĂĽgyfĂ©lnek?
- Volt-e kĂ©rdĂ©s a tesztelĂ©srĹ‘l, adatvĂ©delemrĹ‘l, EU AI ActrĹ‘l?
- KĂ©szĂĽlt-e ĂˇtadĂˇsi dokumentĂˇciĂł?
- HasznĂˇlnĂˇd-e, ha 10 perc alatt generĂˇlna egy white-label ĂˇtadĂˇsi riportot?
- FizetnĂ©l-e 49/149 EUR-t egy ilyen reportĂ©rt?

## KockĂˇzatok

| KockĂˇzat | MitigĂˇciĂł |
|---|---|
| TĂşl szĂ©les scope | MVP csak report + pack generĂˇlĂˇs |
| Jogi tanĂˇcsadĂˇsnak tĹ±nik | kĂ¶vetkezetes â€žreadiness / elĹ‘szĹ±rĂ©s / nem jogi tanĂˇcsâ€ť kommunikĂˇciĂł |
| AI output pontatlan | determinisztikus szabĂˇlyok + human review + evidence pack |
| MCP tĂşl komplex / biztonsĂˇgi kockĂˇzatos | elsĹ‘ verziĂłban readiness Ă©s skeleton, nem automatikus production MCP |
| VersenytĂˇrsak gyorsak | fĂłkusz: agency white-label handoff report, nem enterprise GRC |

## HivatkozĂˇsi alapok

A stratĂ©gia az alĂˇbbi, nyilvĂˇnos Ă©s aktuĂˇlis technolĂłgiai/jogi irĂˇnyokra Ă©pĂ­t:

- EU AI Act: Regulation (EU) 2024/1689, risk-based AI rules; European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- European Commission AI Act Service Desk Compliance Checker: https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker
- European Commission Article 50 transparency draft guidance / consultation, 2026. mĂˇjus: https://digital-strategy.ec.europa.eu/en/consultations/consultation-draft-guidelines-transparency-obligations-under-ai-act
- AGENTS.md nyĂ­lt formĂˇtum: https://agents.md/
- Claude Code CLAUDE.md / memory dokumentĂˇciĂł: https://code.claude.com/docs/en/memory
- Claude Code Skills dokumentĂˇciĂł: https://code.claude.com/docs/en/skills
- Model Context Protocol dokumentĂˇciĂł: https://modelcontextprotocol.io/docs/getting-started/intro

MegjegyzĂ©s: az EU AI Act Ă©rtelmezĂ©si rĂ©szek nem minĹ‘sĂĽlnek jogi tanĂˇcsadĂˇsnak. A termĂ©k kommunikĂˇciĂłjĂˇban is ezt kell kĂ¶vetkezetesen feltĂĽntetni: elĹ‘szĹ±rĂ©s, readiness, dokumentĂˇciĂł-elĹ‘kĂ©szĂ­tĂ©s Ă©s technikai/jogi kĂ©rdĂ©slista kĂ©szĂĽl, nem jogi szakvĂ©lemĂ©ny.
