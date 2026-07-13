/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("notas_publicadas");

  const existing = collection.fields.getByName("ciclo");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("ciclo"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "ciclo",
    required: true,
    values: ["PRIMER CICLO", "SEGUNDO CICLO"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("notas_publicadas");
    collection.fields.removeByName("ciclo");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
