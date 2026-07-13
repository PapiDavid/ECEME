/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("docentes");

  const record0 = new Record(collection);
    record0.set("nombre", "Dr. Fernando Rodr\u00edguez");
    const record0_materia_idLookup = app.findFirstRecordByFilter("materias", "nombre='Matemáticas'");
    if (!record0_materia_idLookup) { throw new Error("Lookup failed for materia_id: no record in 'materias' matching \"nombre='Matemáticas'\""); }
    record0.set("materia_id", record0_materia_idLookup.id);
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record1 = new Record(collection);
    record1.set("nombre", "Ing. Patricia Morales");
    const record1_materia_idLookup = app.findFirstRecordByFilter("materias", "nombre='Física'");
    if (!record1_materia_idLookup) { throw new Error("Lookup failed for materia_id: no record in 'materias' matching \"nombre='Física'\""); }
    record1.set("materia_id", record1_materia_idLookup.id);
  try {
    app.save(record1);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record2 = new Record(collection);
    record2.set("nombre", "Lic. Miguel \u00c1lvarez");
    const record2_materia_idLookup = app.findFirstRecordByFilter("materias", "nombre='Historia'");
    if (!record2_materia_idLookup) { throw new Error("Lookup failed for materia_id: no record in 'materias' matching \"nombre='Historia'\""); }
    record2.set("materia_id", record2_materia_idLookup.id);
  try {
    app.save(record2);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
