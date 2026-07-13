/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Fetch related collections to get their IDs
  const estudiantesCollection = app.findCollectionByNameOrId("estudiantes");
  const docentesCollection = app.findCollectionByNameOrId("docentes");
  const materiasCollection = app.findCollectionByNameOrId("materias");

  const collection = new Collection({
    "createRule": "@request.auth.role = 'profesor'",
    "deleteRule": "@request.auth.role = 'admin'",
    "fields":     [
          {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text8943136339",
                "max": 15,
                "min": 15,
                "name": "id",
                "pattern": "^[a-z0-9]+$",
                "presentable": false,
                "primaryKey": true,
                "required": true,
                "system": true,
                "type": "text"
          },
          {
                "hidden": false,
                "id": "relation0530146075",
                "name": "estudiante_id",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "relation",
                "cascadeDelete": false,
                "collectionId": estudiantesCollection.id,
                "displayFields": [],
                "maxSelect": 1,
                "minSelect": 0
          },
          {
                "hidden": false,
                "id": "relation3646830591",
                "name": "docente_id",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "relation",
                "cascadeDelete": false,
                "collectionId": docentesCollection.id,
                "displayFields": [],
                "maxSelect": 1,
                "minSelect": 0
          },
          {
                "hidden": false,
                "id": "relation8713028700",
                "name": "materia_id",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "relation",
                "cascadeDelete": false,
                "collectionId": materiasCollection.id,
                "displayFields": [],
                "maxSelect": 1,
                "minSelect": 0
          },
          {
                "hidden": false,
                "id": "number1799199245",
                "name": "parcial1",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "number",
                "max": 100,
                "min": 0,
                "onlyInt": false
          },
          {
                "hidden": false,
                "id": "number2959234725",
                "name": "parcial_final",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "number",
                "max": 100,
                "min": 0,
                "onlyInt": false
          },
          {
                "hidden": false,
                "id": "number0007881421",
                "name": "trabajos",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "number",
                "max": 100,
                "min": 0,
                "onlyInt": false
          },
          {
                "hidden": false,
                "id": "select9695271920",
                "name": "ciclo",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "select",
                "maxSelect": 1,
                "values": [
                      "PRIMER CICLO",
                      "SEGUNDO CICLO"
                ]
          },
          {
                "hidden": false,
                "id": "autodate6739459045",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
          },
          {
                "hidden": false,
                "id": "autodate7501184305",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
          }
    ],
    "id": "pbc_6809080036",
    "indexes": [],
    "listRule": "@request.auth.role = 'admin'",
    "name": "notas",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.role = 'profesor'",
    "viewRule": "estudiante_id.id = @request.auth.id || @request.auth.role = 'admin'"
  });

  try {
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("Collection name must be unique")) {
      console.log("Collection already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_6809080036");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
