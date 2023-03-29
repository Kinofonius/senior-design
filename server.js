const express = require('express');
const { loadSync } = require('protobufjs');
const os = require('os');
const { MongoClient } = require('mongodb');

const app = express();
const port = 3000;
const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'stageControl';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
run().catch((err) => console.log(err));


function loadProtoTypes() {
  const root = loadSync('stage.proto');
  return {
    GetSceneListResponse: root.lookupType('stage.v1.GetSceneListResponse'),
    GetSceneResponse: root.lookupType('stage.v1.GetSceneResponse'),
    GetCurrentSceneResponse: root.lookupType('stage.v1.GetCurrentSceneResponse'),
    SetSceneRequest: root.lookupType('stage.v1.SetSceneRequest'),
    SetSceneResponse: root.lookupType('stage.v1.SetSceneResponse'),
    SetFixtureRequest: root.lookupType('stage.v1.SetFixtureRequest'),
    SetFixtureResponse: root.lookupType('stage.v1.SetFixtureResponse'),
    CreateSceneRequest: root.lookupType('stage.v1.CreateSceneRequest'),
    CreateSceneResponse: root.lookupType('stage.v1.CreateSceneResponse'),
    DeleteSceneRequest: root.lookupType('stage.v1.DeleteSceneRequest'),
    DeleteSceneResponse: root.lookupType('stage.v1.DeleteSceneResponse'),
    CreateFixtureRequest: root.lookupType('stage.v1.CreateFixtureRequest'),
    CreateFixtureResponse: root.lookupType('stage.v1.CreateFixtureResponse'),
    DeleteFixtureRequest: root.lookupType('stage.v1.DeleteFixtureRequest'),
    DeleteFixtureResponse: root.lookupType('stage.v1.DeleteFixtureResponse'),
    UpdateCurrentSceneRequest: root.lookupType('stage.v1.UpdateCurrentSceneRequest'),
    UpdateCurrentSceneResponse: root.lookupType('stage.v1.UpdateCurrentSceneResponse'),
    AddFixturesToSceneRequest: root.lookupType('stage.v1.AddFixturesToSceneRequest'),
    AddFixturesToSceneResponse: root.lookupType('stage.v1.AddFixturesToSceneResponse'),
    RemoveAllFixturesFromSceneRequest: root.lookupType('stage.v1.RemoveAllFixturesFromSceneRequest'),
    RemoveAllFixturesFromSceneResponse: root.lookupType('stage.v1.RemoveAllFixturesFromSceneResponse'),
  };
}
async function ensureCollectionsExist(db) {
  const collections = await db.collections();
  const collectionNames = collections.map((collection) => collection.collectionName);

  if (!collectionNames.includes('fixtures')) {
    await db.createCollection('fixtures');
  }
  if (!collectionNames.includes('scenes')) {
    await db.createCollection('scenes');
  }
  if (!collectionNames.includes('state')) {
    await db.createCollection('state');
  }
}

async function run() {

  await client.connect();
  console.log('Connected to MongoDB successfully!');
  
  const db = client.db(dbName);
  await ensureCollectionsExist(db);
  const fixturesCollection = db.collection('fixtures');
  const scenesCollection = db.collection('scenes');
  const protoTypes = loadProtoTypes();
  app.use(express.raw({ type: 'application/octet-stream' }));

// Get scene list
app.get('/get-scene-list', async (req, res) => {
  const scenes = await scenesCollection.find().toArray();
  const response = protoTypes.GetSceneListResponse.encode({
    scenes: scenes.map((scene) => ({ id: scene.id, name: scene.name.toString() })),
  }).finish();

  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});

// Get scene by ID
app.get('/get-scene/:sceneId', async (req, res) => {
  const sceneId = parseInt(req.params.sceneId);
  const scene = await scenesCollection.findOne({ id: sceneId });

  if (scene) {
    const fixtures = await fixturesCollection.find().toArray();
    const response = protoTypes.GetSceneResponse.encode({
      scene: {
        id: scene.id,
        name: String(scene.name),
        external: scene.external,
        stage: {
          fixtures: fixtures.map((fixture) => fixture.id),
        },
      },
    }).finish();

    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send('Scene not found');
  }
});

// Helper function to get the current scene ID
async function getCurrentSceneId(db) {
  const currentSceneIdDoc = await db.collection('state').findOne({ key: 'currentSceneId' });
  return currentSceneIdDoc ? currentSceneIdDoc.value : null;
}

// Helper function to set the current scene ID
async function setCurrentSceneId(db, newSceneId) {
  const currentSceneIdDoc = await db.collection('state').findOne({ key: 'currentSceneId' });

  if (!currentSceneIdDoc) {
    await db.collection('state').insertOne({
      key: 'currentSceneId',
      value: newSceneId,
    });
  } else {
    await db.collection('state').updateOne(
      { key: 'currentSceneId' },
      { $set: { value: newSceneId } }
    );
  }
}

// Get current scene
app.get('/get-current-scene', async (req, res) => {
  const currentSceneId = await getCurrentSceneId(db);

  if (!currentSceneId) {
    res.status(404).send('Current scene not found');
    return;
  }

  const currentScene = await scenesCollection.findOne({ id: currentSceneId });

  if (currentScene) {
    const response = protoTypes.GetCurrentSceneResponse.encode({
      scene: String(currentScene.id),
    }).finish();

    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send('Current scene not found');
  }
});

// Update current scene
app.post('/update-current-scene', async (req, res) => {
  const decodedRequest = protoTypes.UpdateCurrentSceneRequest.decode(req.body);
  const newCurrentSceneId = decodedRequest.newSceneId;

  // Check if the new scene id is valid
  const newScene = await scenesCollection.findOne({ id: newCurrentSceneId });
  if (!newScene) {
    return res.status(400).send('Invalid scene id');
  }

  // Update the current scene ID in the database
  await setCurrentSceneId(db, newCurrentSceneId);
  const response = protoTypes.UpdateCurrentSceneResponse.encode({}).finish();

  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});

// Set scene
app.post('/set-scene', async (req, res) => {
  const decodedRequest = protoTypes.SetSceneRequest.decode(req.body);
  const { uuid, scene: sceneData } = decodedRequest;

  if (sceneData.external) {
    res.status(400).send('Cannot change external scenes');
  } else {
    const updatedResult = await scenesCollection.updateOne(
      { id: uuid },
      {
        $set: {
          name: String(sceneData.name),
          external: sceneData.external,
          fixture: sceneData.fixture,
        },
      }
    );

    if (updatedResult.matchedCount > 0) {
      const updatedScene = await scenesCollection.findOne({ id: uuid });
      const response = protoTypes.SetSceneResponse.encode({
        scene: updatedScene,
      }).finish();
      res.set('Content-Type', 'application/octet-stream');
      res.send(response);
    } else {
      res.status(404).send(`Scene with ID ${uuid} not found`);
    }
  }
});
// Set fixture
app.post('/set-fixture', async (req, res) => {
  const decodedRequest = protoTypes.SetFixtureRequest.decode(req.body);
  const { scene: sceneId, fixture } = decodedRequest;
  const targetScene = await scenesCollection.findOne({ id: sceneId });

  if (!targetScene) {
    res.status(404).send(`Scene with ID ${sceneId} not found`);
  } else if (targetScene.external) {
    res.status(400).send('Cannot modify fixtures in external scenes');
  } else {
    const updatedResult = await fixturesCollection.updateOne(
      { id: fixture.id },
      {
        $set: {
          channels: fixture.channels,
        },
      }
    );

    if (updatedResult.matchedCount > 0) {
      const updatedFixture = await fixturesCollection.findOne({ id: fixture.id });
      const response = protoTypes.SetFixtureResponse.encode({
        fixture: updatedFixture,
      }).finish();
      res.set('Content-Type', 'application/octet-stream');
      res.send(response);
    } else {
      res.status(400).send(`Fixture with ID ${fixture.id} not found in scene ${sceneId}`);
    }
  }
});

// Create a new scene
app.post('/create-scene', async (req, res) => {
  const decodedRequest = protoTypes.CreateSceneRequest.decode(req.body);
  const sceneData = decodedRequest.scene;

  const sceneName = sceneData.name;
  const existingScene = await scenesCollection.findOne({ name: sceneName });

  if (existingScene) {
    res.status(400).send('Scene name already exists');
    return;
  }

  const scenes = await scenesCollection.find().sort({ id: -1 }).limit(1).toArray();
  const newSceneId = scenes.length > 0 ? scenes[0].id + 1 : 1;
  const newScene = {
    ...sceneData,
    id: newSceneId,
  };
  await scenesCollection.insertOne(newScene);

  const response = protoTypes.CreateSceneResponse.encode({ scene: newScene }).finish();
  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});

// Delete a scene
app.post('/delete-scene', async (req, res) => {
  const decodedRequest = protoTypes.DeleteSceneRequest.decode(req.body);
  const { uuid } = decodedRequest;

  const existingScene = await scenesCollection.findOne({ id: uuid }); // <-- Change here
  if (!existingScene) {
    res.status(404).send(`Scene with ID ${uuid} not found`);
    return;
  }

  const deletedResult = await scenesCollection.deleteOne({ id: uuid });
  if (deletedResult.deletedCount > 0) {
    const response = protoTypes.DeleteSceneResponse.encode({ uuid }).finish();
    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send(`Scene with ID ${uuid} not found`);
  }
});

// Create a new fixture
app.post('/create-fixture', async (req, res) => {
  const decodedRequest = protoTypes.CreateFixtureRequest.decode(req.body);
  const fixtureData = decodedRequest.fixture;

  const lastFixture = await fixturesCollection.find().sort({ id: -1 }).limit(1).toArray();
  const newFixtureId = lastFixture.length > 0 ? lastFixture[0].id + 1 : 1; // <-- Change here
  const newFixture = {
    ...fixtureData,
    id: newFixtureId,
  };
  await fixturesCollection.insertOne(newFixture);

  const response = protoTypes.CreateFixtureResponse.encode({ fixture: newFixture }).finish();
  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});
// Delete a fixture
app.post('/delete-fixture', async (req, res) => {
  const decodedRequest = protoTypes.DeleteFixtureRequest.decode(req.body);
  const { id } = decodedRequest;

  const existingFixture = await fixturesCollection.findOne({ id: id }); // <-- Change here
  if (!existingFixture) {
    res.status(404).send(`Fixture with ID ${id} not found`);
    return;
  }

  const deletedResult = await fixturesCollection.deleteOne({ id: id });
  if (deletedResult.deletedCount > 0) {
    const response = protoTypes.DeleteFixtureResponse.encode({ id }).finish();
    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send(`Fixture with ID ${id} not found`);
  }
});

// Add fixtures to scene
app.post('/add-fixtures-to-scene', async (req, res) => {
  const decodedRequest = protoTypes.AddFixturesToSceneRequest.decode(req.body);
  const { sceneId, fixtureIds } = decodedRequest;

  // Check if scene exists
  const scene = await scenesCollection.findOne({ id: sceneId });
  if (!scene) {
    return res.status(404).send(`Scene with ID ${sceneId} not found`);
  }

  // Check if fixture ids are valid
  const fixtures = await fixturesCollection.find({ id: { $in: fixtureIds } }).toArray();
  if (fixtures.length !== fixtureIds.length) {
    return res.status(400).send('Some fixture ids are invalid');
  }
  // Replace fixtures in the scene
  scene.stage.fixtures = fixtureIds.map((id) => {
    const fixture = fixtures.find((f) => f.id === id);
    return { id: fixture.id};
  });
  // Add fixtures to scene
  const updatedScene = await scenesCollection.updateOne(
    { id: sceneId },
    { $addToSet: { 'stage.fixtures': { $each: fixtureIds } } }
  );

  const response = protoTypes.AddFixturesToSceneResponse.encode({}).finish();
  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});

// Remove all fixtures from scene
app.post('/remove-all-fixtures-from-scene', async (req, res) => {
  const decodedRequest = protoTypes.RemoveAllFixturesFromSceneRequest.decode(req.body);
  const { sceneId } = decodedRequest;

  // Check if scene exists
  const scene = await scenesCollection.findOne({ id: sceneId });
  if (!scene) {
    return res.status(404).send(`Scene with ID ${sceneId} not found`);
  }

  // Remove all fixtures from scene
  const updatedScene = await scenesCollection.updateOne(
    { id: sceneId },
    { $set: { 'stage.fixtures': [] } }
  );

  const response = protoTypes.RemoveAllFixturesFromSceneResponse.encode({}).finish();
  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});
  app.listen(port, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`Server listening on ${localIP}:${port}`);
  });
  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const ifName in interfaces) {
      const ifItems = interfaces[ifName];
      for (const item of ifItems) {
        if (!item.internal && item.family === 'IPv4') {
          return item.address;
        }
      }
    }
    return '127.0.0.1';
  }
  // app.listen(port, () => {
  //   console.log(`Server listening on port ${port}`);
  // });
}