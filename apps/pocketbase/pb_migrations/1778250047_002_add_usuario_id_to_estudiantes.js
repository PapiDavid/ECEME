/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usuariosCollection = app.findCollectionByNameOrId("usuarios");
  const collection = app.findCollectionByNameOrId("estudiantes");

  const existing = collection.fields.getByName("usuario_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("usuario_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "usuario_id",
    required: true,
    collectionId: usuariosCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("estudiantes");
    collection.fields.removeByName("usuario_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
