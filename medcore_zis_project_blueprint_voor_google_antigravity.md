# MedCore ZIS (Ziekenhuis Informatie Systeem) - Project Blauwdruk

Dit document bevat de volledige specificaties, de architectuur van de designtaal en de functionele vereisten voor de ontwikkeling van de MedCore ZIS PWA.

## 1. Project Visie & Design Systeem: 'Clinical Tactility'

De app is ontworpen om medisch personeel een rustige, betrouwbare en tactiele ervaring te bieden door middel van Neumorphic (soft UI) principes.

### 1.1 Kernwaarden
- **Betrouwbaarheid**: Gebruik van het MedCore Teal (#007a8c) als ankerkleur.
- **Focus**: Minimalistische interface met diepte door schaduwen in plaats van felle scheidingslijnen.
- **Toegankelijkheid**: Hoge leesbaarheid door de Manrope font-familie en ruime witruimte.

### 1.2 Design Tokens
- **Font**: Manrope (Sans-serif)
- **Primary Color**: #007a8c (Medisch Teal)
- **Surface**: #f9f9ff (Lichtgrijs/blauw voor de basis)
- **Shadows (Light Mode)**: 
  - Light: #FFFFFF (-8px -8px 12px)
  - Dark: #B8BFC9 (8px 8px 12px)
- **Roundness**: 8px (Round Eight)

---

## 2. Shared Components Architectuur

De app maakt gebruik van een consistente set herbruikbare componenten die de neumorphic stijl definiëren:

- **TopAppBar**: Bevat de merknaam 'MedCore ZIS', contextuele navigatie en het gebruikersprofiel.
- **BottomNavBar**: Vier hoofdsecties: Dashboard, Patients, Schedule, Records.
- **Neumorphic Card**: De bouwsteen voor alle lijsten en details, met zachte schaduwen en afgeronde hoeken.
- **Floating Action Button (FAB)**: Altijd in MedCore Teal voor primaire acties zoals "Nieuwe afspraak" of "Toevoegen".

---

## 3. Functionele Modules & Schermenoverzicht

### 3.1 Dashboard & Beheer
- **ZIS Dashboard ({{DATA:SCREEN:SCREEN_32}})**: Centrale hub met actuele taken en meldingen.
- **Gebruikers- & Toegangsbeheer ({{DATA:SCREEN:SCREEN_43}}, {{DATA:SCREEN:SCREEN_40}})**: Uitgebreid RBAC (Role-Based Access Control) systeem voor rollen zoals Superuser, Dokter, Apotheker en Verpleegkundige met CRUD-rechten per scherm.

### 3.2 Patiëntendossier (EPD)
- **Patiëntenoverzicht ({{DATA:SCREEN:SCREEN_24}})**: Lijst met BSN-identificatie en zoekfilters.
- **Medisch Dossier Detail ({{DATA:SCREEN:SCREEN_28}})**: Centraal dossier met diagnoses, behandeltrajecten en actuele medicatie (bijv. Atorvastatine).
- **Bezoekgeschiedenis ({{DATA:SCREEN:SCREEN_18}})**: Chronologische tijdlijn van alle interacties per patiënt.

### 3.3 Planning & Consultatie
- **Afsprakenoverzicht per Arts ({{DATA:SCREEN:SCREEN_12}})**: Dag- en weekweergave voor specialisten.
- **Consult Registratie ({{DATA:SCREEN:SCREEN_8}})**: Geïntegreerde workflow voor het koppelen van diagnoses en het direct voorschrijven van medicatie.
- **Nieuwe Afspraak ({{DATA:SCREEN:SCREEN_13}})**: Kalender-gebaseerde planningstool voor patiënten.

### 3.4 Apotheek & Lab
- **Voorraadbeheer ({{DATA:SCREEN:SCREEN_3}})**: Real-time inzicht in medicatievoorraad, locaties (Centraal/Afdeling) en batch-traceerbaarheid.
- **Medicatie Detail ({{DATA:SCREEN:SCREEN_23}})**: Specifieke monitoring voor kritieke medicatie zoals Morfine, inclusief verbruiksgrafieken.
- **Lab-uitslagen ({{DATA:SCREEN:SCREEN_22}})**: Overzicht van rapporten met PDF-export en zoekfunctionaliteit.

---

## 4. Technische Specificaties
- **Type**: Progressive Web App (PWA).
- **Storage**: Ontworpen voor offline-first gebruik met lokale gegevensopslag voor maximale snelheid in klinische omgevingen.
- **Interactions**: Tactiele feedback door 'inset' schaduwen bij actieve staten (buttons, inputs).

---
*Gegenereerd voor Google Antigravity implementatie*
