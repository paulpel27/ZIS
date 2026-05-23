/**
 * MedCore ZIS - Local Database Module
 * Uses Dexie.js for an elegant, offline-first IndexedDB wrapper.
 */

// Initialize database
const db = new Dexie("MedCoreZIS");

// Define schema
db.version(1).stores({
  users: '++id, &username, role',
  patients: '++id, &bsn, name',
  dossiers: '++id, &patientId',
  visits: '++id, patientId, date, doctorName',
  appointments: '++id, patientId, doctorId, date, time',
  inventory: '++id, medicationName, location, isCritical',
  labResults: '++id, patientId, testDate, status',
  auditLogs: '++id, timestamp, username, action'
});

// Seed data helper
async function seedDatabase() {
  const userCount = await db.users.count();
  if (userCount > 0) {
    console.log("Database already contains data. Skipping seed.");
    return;
  }

  console.log("Database is empty. Seeding clinical mock data...");

  // 1. Seed Users (passwords are plain text for simplicity of this client-only demo)
  const users = [
    { username: "admin", password: "123", name: "Dr. Alexis Vance (Admin)", role: "Superuser", specialty: "Systeembeheer" },
    { username: "dr_janssen", password: "123", name: "Dr. Albert Janssen", role: "Dokter", specialty: "Cardiologie" },
    { username: "dr_hendriks", password: "123", name: "Dr. Eline Hendriks", role: "Dokter", specialty: "Algemene Geneeskunde" },
    { username: "apotheker_de_vries", password: "123", name: "Dr. Luuk de Vries", role: "Apotheker", specialty: "Klinische Farmacie" },
    { username: "zuster_sara", password: "123", name: "Sara van Dongen", role: "Verpleegkundige", specialty: "Spoedeisende Hulp" }
  ];
  await db.users.bulkAdd(users);

  // 2. Seed Patients
  const patients = [
    { bsn: "123456789", name: "Johan de Wit", dob: "1962-04-15", gender: "Man", phone: "0612345678", email: "j.dewit@example.com", address: "Keizersgracht 42, Amsterdam" },
    { bsn: "987654321", name: "Maria Kleijn-Schouten", dob: "1975-09-22", gender: "Vrouw", phone: "0687654321", email: "m.kleijn@example.com", address: "Singel 105, Utrecht" },
    { bsn: "543216789", name: "Daan Albers", dob: "1998-11-03", gender: "Man", phone: "0654321098", email: "daan.albers@example.com", address: "Witte de Withstraat 12, Rotterdam" },
    { bsn: "112233445", name: "Sophie Willems", dob: "1948-07-30", gender: "Vrouw", phone: "0622334455", email: "sophie.willems@example.com", address: "Grote Markt 7, Haarlem" }
  ];
  const patientIds = [];
  for (const patient of patients) {
    const id = await db.patients.add(patient);
    patientIds.push(id);
  }

  // 3. Seed Dossiers linked to patients
  const dossiers = [
    {
      patientId: patientIds[0], // Johan de Wit
      diagnoses: [
        { code: "I10", name: "Essentiële (primaire) hypertensie", date: "2023-01-12", status: "Actief" },
        { code: "I25.1", name: "Atherosclerotische hartziekte", date: "2024-05-10", status: "Actief" }
      ],
      treatments: [
        { name: "Levensstijl aanpassing (zoutarm dieet)", desc: "Minder dan 2g natrium per dag, matige lichaamsbeweging.", startDate: "2023-01-12", endDate: "", status: "Lopend" }
      ],
      medications: [
        { name: "Atorvastatine 40mg", dosage: "1 tablet", frequency: "1x per dag (avond)", prescribedBy: "Dr. Albert Janssen", startDate: "2024-05-10", status: "Actief" },
        { name: "Amlodipine 5mg", dosage: "1 tablet", frequency: "1x per dag (ochtend)", prescribedBy: "Dr. Albert Janssen", startDate: "2023-01-12", status: "Actief" }
      ]
    },
    {
      patientId: patientIds[1], // Maria Kleijn-Schouten
      diagnoses: [
        { code: "E11.9", name: "Diabetes mellitus type 2 zonder complicaties", date: "2022-09-08", status: "Actief" }
      ],
      treatments: [
        { name: "Metformine therapie", desc: "Startdosering 500mg, opgevoerd naar 1000mg tweemaal daags.", startDate: "2022-09-08", endDate: "", status: "Lopend" }
      ],
      medications: [
        { name: "Metformine 1000mg", dosage: "1 tablet", frequency: "2x per dag (bij maaltijd)", prescribedBy: "Dr. Eline Hendriks", startDate: "2022-09-08", status: "Actief" }
      ]
    },
    {
      patientId: patientIds[2], // Daan Albers
      diagnoses: [
        { code: "J45.9", name: "Astma, niet gespecificeerd", date: "2018-04-20", status: "Actief" }
      ],
      treatments: [
        { name: "Inhalatietherapie zo nodig", desc: "Salbutamol bij acute dyspneu.", startDate: "2018-04-20", endDate: "", status: "Lopend" }
      ],
      medications: [
        { name: "Salbutamol 100mcg/dosis inhalator", dosage: "1-2 inhalaties", frequency: "Zo nodig (max 4x/dag)", prescribedBy: "Dr. Eline Hendriks", startDate: "2018-04-20", status: "Actief" }
      ]
    },
    {
      patientId: patientIds[3], // Sophie Willems
      diagnoses: [
        { code: "M17.0", name: "Primaire artrose van beide knieën", date: "2020-03-15", status: "Actief" },
        { code: "I21.9", name: "Acuut myocardinfarct (historie)", date: "2025-11-20", status: "Inactief" }
      ],
      treatments: [
        { name: "Post-infarct revalidatie", desc: "Fysiotherapie en cardiale monitoring.", startDate: "2025-11-25", endDate: "2026-03-01", status: "Voltooid" },
        { name: "Knie-artroplastiek (links) gepland", desc: "Consult orthopedie voor totale knieprothese.", startDate: "2026-04-01", endDate: "", status: "Lopend" }
      ],
      medications: [
        { name: "Morfine 10mg (retard)", dosage: "1 tablet", frequency: "2x per dag (12-uurs)", prescribedBy: "Dr. Albert Janssen", startDate: "2026-04-10", status: "Actief" },
        { name: "Ascorzuur 500mg", dosage: "1 tablet", frequency: "1x per dag", prescribedBy: "Dr. Eline Hendriks", startDate: "2026-02-01", status: "Actief" }
      ]
    }
  ];
  await db.dossiers.bulkAdd(dossiers);

  // 4. Seed Visits
  const visits = [
    {
      patientId: patientIds[0],
      date: "2026-05-10",
      doctorName: "Dr. Albert Janssen",
      complaints: "Milde druk op de borst bij traplopen.",
      findings: "Bloeddruk 142/85 mmHg, pols 72 slagen/min. ECG toont geen acute ischemie, wel bekende hypertrofie.",
      diagnosis: "Stabiele angina pectoris verdenking. Aanpassing medicatie.",
      notes: "Atorvastatine verhoogd naar 40mg. Patiënt geadviseerd om direct contact op te nemen bij rustpijn."
    },
    {
      patientId: patientIds[1],
      date: "2026-04-18",
      doctorName: "Dr. Eline Hendriks",
      complaints: "Reguliere driemaandelijkse diabetes controle.",
      findings: "HbA1c is 51 mmol/mol (doel: <53). Gewicht stabiel. Voeten gecontroleerd: geen neuropathie.",
      diagnosis: "Diabetes Type 2, goed ingesteld op Metformine.",
      notes: "Metformine continueren. Volgende controle over 3 maanden."
    },
    {
      patientId: patientIds[3],
      date: "2026-05-12",
      doctorName: "Dr. Albert Janssen",
      complaints: "Ernstige pijn in linkerknie door gevorderde artrose. Post-infarct controle.",
      findings: "Knie is licht gezwollen, beweging beperkt. Hart/longen stabiel, bloeddruk 130/75 mmHg.",
      diagnosis: "Artrose pijn waarvoor opioïd noodzakelijk.",
      notes: "Gestart met Morfine 10mg retard voor pijnstilling in aanloop naar operatie. Strikte controle op voorraad en inname."
    }
  ];
  await db.visits.bulkAdd(visits);

  // 5. Seed Appointments
  const appointments = [
    { patientId: patientIds[0], doctorId: "dr_janssen", doctorName: "Dr. Albert Janssen", date: "2026-05-23", time: "10:30", reason: "ECG controle en labbespreking", status: "Gepland" },
    { patientId: patientIds[1], doctorId: "dr_hendriks", doctorName: "Dr. Eline Hendriks", date: "2026-05-23", time: "11:15", reason: "Diabetes controle", status: "Gepland" },
    { patientId: patientIds[2], doctorId: "dr_hendriks", doctorName: "Dr. Eline Hendriks", date: "2026-05-24", time: "09:00", reason: "Astma inhalatietechniek controle", status: "Gepland" },
    { patientId: patientIds[3], doctorId: "dr_janssen", doctorName: "Dr. Albert Janssen", date: "2026-05-24", time: "14:30", reason: "Pre-operatieve screening knie", status: "Gepland" }
  ];
  await db.appointments.bulkAdd(appointments);

  // 6. Seed Pharmacy Inventory
  const inventory = [
    { medicationName: "Atorvastatine 40mg", stock: 1200, unit: "tabletten", location: "Centraal", batchNumber: "AT-2026-01", expiryDate: "2028-12-31", isCritical: false },
    { medicationName: "Atorvastatine 40mg", stock: 150, unit: "tabletten", location: "Afdeling Cardiologie", batchNumber: "AT-2026-01", expiryDate: "2028-12-31", isCritical: false },
    { medicationName: "Metformine 1000mg", stock: 3000, unit: "tabletten", location: "Centraal", batchNumber: "MF-2025-09", expiryDate: "2027-09-30", isCritical: false },
    { medicationName: "Salbutamol 100mcg/dosis", stock: 80, unit: "inhalatoren", location: "Centraal", batchNumber: "SB-2025-11", expiryDate: "2027-11-30", isCritical: false },
    { medicationName: "Morfine 10mg (retard)", stock: 500, unit: "tabletten", location: "Centraal", batchNumber: "MF-CRIT-99", expiryDate: "2029-06-30", isCritical: true },
    { medicationName: "Morfine 10mg (retard)", stock: 30, unit: "tabletten", location: "Afdeling Cardiologie", batchNumber: "MF-CRIT-99", expiryDate: "2029-06-30", isCritical: true },
    { medicationName: "Amlodipine 5mg", stock: 800, unit: "tabletten", location: "Centraal", batchNumber: "AL-2025-05", expiryDate: "2028-05-15", isCritical: false }
  ];
  await db.inventory.bulkAdd(inventory);

  // 7. Seed Lab Results
  const labResults = [
    {
      patientId: patientIds[0],
      testName: "Lipidenprofiel & Nierfunctie",
      testDate: "2026-05-08",
      reportedBy: "Lab Centraal (Dr. R. de Graaf)",
      status: "Definitief",
      resultData: {
        "Cholesterol Totaal": { value: 4.8, unit: "mmol/l", reference: "< 5.0", status: "Normaal" },
        "HDL Cholesterol": { value: 1.1, unit: "mmol/l", reference: "> 1.0", status: "Normaal" },
        "LDL Cholesterol": { value: 2.8, unit: "mmol/l", reference: "< 3.0", status: "Normaal" },
        "Triglyceriden": { value: 1.9, unit: "mmol/l", reference: "< 2.0", status: "Normaal" },
        "Kreatinine": { value: 88, unit: "umol/l", reference: "60 - 110", status: "Normaal" },
        "eGFR (CKD-EPI)": { value: 78, unit: "ml/min/1.73m2", reference: "> 60", status: "Normaal" }
      }
    },
    {
      patientId: patientIds[1],
      testName: "HbA1c & Glucose",
      testDate: "2026-04-15",
      reportedBy: "Lab Centraal (Dr. R. de Graaf)",
      status: "Definitief",
      resultData: {
        "Glucose (nuchter)": { value: 6.8, unit: "mmol/l", reference: "4.0 - 6.0", status: "Verhoogd" },
        "HbA1c": { value: 51, unit: "mmol/mol", reference: "< 53 (diabetici)", status: "Normaal" }
      }
    },
    {
      patientId: patientIds[3],
      testName: "Bloedbeeld & Stolling",
      testDate: "2026-05-11",
      reportedBy: "Lab Centraal (Dr. R. de Graaf)",
      status: "Definitief",
      resultData: {
        "Hemoglobine (Hb)": { value: 8.2, unit: "mmol/l", reference: "7.5 - 10.0", status: "Normaal" },
        "Leukocyten": { value: 6.4, unit: "10^9/l", reference: "4.0 - 10.0", status: "Normaal" },
        "Trombocyten": { value: 245, unit: "10^9/l", reference: "150 - 400", status: "Normaal" },
        "INR": { value: 1.1, unit: "", reference: "0.8 - 1.2", status: "Normaal" }
      }
    }
  ];
  await db.labResults.bulkAdd(labResults);

  // 8. Seed Audit Logs
  const logs = [
    { timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), username: "system", action: "DATABASE_INITIALIZATION", details: "Lokale database succesvol geïnitialiseerd." },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), username: "admin", action: "SEED_DATA", details: "Klinische demo-data succesvol ingeladen." }
  ];
  await db.auditLogs.bulkAdd(logs);

  console.log("Seeding completed successfully.");
}

// Audit log helper
async function logAction(username, action, details) {
  try {
    await db.auditLogs.add({
      timestamp: new Date().toISOString(),
      username: username || "Onbekend",
      action: action,
      details: details || ""
    });
  } catch (err) {
    console.error("Fout bij schrijven naar audit log:", err);
  }
}

// Expose initialize call
db.on("ready", async () => {
  await seedDatabase();
});

db.open().catch(err => {
  console.error("Mislukt om database te openen:", err);
});
