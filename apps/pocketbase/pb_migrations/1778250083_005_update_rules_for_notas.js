/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("notas");
  collection.listRule = "estudiante_id.usuario_id = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'docente'";
  collection.viewRule = "estudiante_id.usuario_id = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'docente'";
  collection.createRule = "@request.auth.role = 'docente' || @request.auth.role = 'admin'";
  collection.updateRule = "@request.auth.role = 'docente' || @request.auth.role = 'admin'";
  collection.deleteRule = "@request.auth.role = 'admin'";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("notas");
  collection.listRule = "@request.auth.role = 'admin'";
  collection.viewRule = "estudiante_id.id = @request.auth.id || @request.auth.role = 'admin'";
  collection.createRule = "@request.auth.role = 'profesor'";
  collection.updateRule = "@request.auth.role = 'profesor'";
  collection.deleteRule = "@request.auth.role = 'admin'";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
