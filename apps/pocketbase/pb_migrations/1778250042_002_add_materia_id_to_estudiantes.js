/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const materiasCollection = app.findCollectionByNameOrId("materias");
  const collection = app.findCollectionByNameOrId("estudiantes");

  const existing = collection.fields.getByName("materia_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("materia_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "materia_id",
    required: true,
    collectionId: materiasCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("estudiantes");
    collection.fields.removeByName("materia_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
