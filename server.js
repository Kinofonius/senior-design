const express = require('express');
const { loadSync } = require('protobufjs');
const os = require('os');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

  // Enable CORS support
app.use(cors());
const port = 3000;
const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'stageControl';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
run().catch((err) => console.log(err));
app.use(bodyParser.json());
function loadBackendProtoTypes() {
  const root = loadSync('backend.proto');
  return {
    SceneId: root.lookupType('SceneId'),
    SceneUpdateEvent: root.lookupType('SceneUpdateEvent'),
    Message: root.lookupType('Message'),
  }
}

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
  app.listen(port, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`Server listening on ${localIP}:${port}`);
  });
  const db = client.db(dbName);
  await ensureCollectionsExist(db);
  const fixturesCollection = db.collection('fixtures');
  const scenesCollection = db.collection('scenes');
  const stateCollection = db.collection('state');
  const protoTypes = loadProtoTypes();
  const backendTypes = loadBackendProtoTypes();
  app.use(express.raw({ type: 'application/octet-stream' }));

  const backend = new WebSocket('ws://192.168.1.14:8080/api/ws');
  backend.on('error', console.log);
  let universe = new Uint8Array(512);
  let toggleButton = false;
  let trick = true;

  function objectToUint8Array(obj) { 
    const len = Object.keys(obj).length; 
    const uint8Array = new Uint8Array(len); 
    for (let i = 0; i < len; i++) { 
      uint8Array[i] = obj[i]; 
    } 
    return uint8Array; 
  }

  const hexStringToUint8Array = (hexString) => {
    // Convert the hex string to a Buffer
    
    const buffer = hexString.buffer;
    // Create a new Uint8Array of the desired length
    const uint8Array = new Uint8Array(512);
  
    // Copy the content from the Buffer to the Uint8Array
    for (let i = 0; i < 512; i++) {
      uint8Array[i] = buffer[i];
      //console.log("???",uint8Array[i]); 
    }
    return uint8Array;
  };
  
  //the list that contails fixtures
  // const fixtureList = new Array();
  //channels from left to right 37-40 53-53 55-65 41-44 45-48 66-76 54-54 49-52
  async function setLightValues(index, values) {
    const channelMapping = [
      { start: 36, end: 39 },
      { start: 52, end: 52 },
      { start: 54, end: 64 },
      { start: 40, end: 43 },
      { start: 44, end: 47 },
      { start: 65, end: 75 },
      { start: 53, end: 53 },
      { start: 48, end: 51 },
    ];
  
    const channelRange = channelMapping[index];
    if (!channelRange) {
      throw new Error(`Invalid index: ${index}`);
    }
  
    
    if (values.length !== channelRange.end - channelRange.start + 1) {
      console.log(`Invalid values length for index ${index}: ${values.length}`,values);
      throw new Error(`Invalid values length for index ${index}: ${values.length}`);
    }
    
  
    for (let i = 0; i < values.length; i++) {
      universe[channelRange.start + i] = values[i];
    }
    // const lastFixture = await fixturesCollection.find().sort({ id: -1 }).limit(1).toArray();
    // const newFixtureId = lastFixture.length > 0 ? lastFixture[0].id + 1 : 1;
    // const newFixture = {
    //   channels: universe,
    //   id: newFixtureId,
    // };
    // await fixturesCollection.insertOne(newFixture);
    // fixtureList.push(newFixtureId)
      // const currentSceneId = await getCurrentSceneId(db);
      // const scene = await scenesCollection.findOne({ name: currentSceneId });
      // if (!scene) {
      //   return;
      // }
      // await scenesCollection.updateOne(
      //   { name: currentSceneId },
      //   { $set: { stage: {
      //     fixtures:universe,
      //   } } }
      // );
    if (toggleButton) {
      let name = "FalseFalse";
      if (trick) {
        name = "TrueTrue";
      }
      trick = !trick;
      await setCurrentSceneId(db, name);
      await sendSceneUpdate(name,universe);
    }
    return universe;
  }
  function sendBackendMessage(message) {
    if (backend.readyState !== 1) {
      console.log('No connection to backend!');
      return;
    }

    try {
      backend.send(backendTypes.Message.encode(message).finish());
    } catch (_) {
      console.log('Failed to send backend message');
    }
  }

  function sendSceneUpdate(id, universe) {
    const rawScene = {
      id: String(id),
      universe,
    };
    sendBackendMessage({
      type: 1,
      name: 'SceneUpdate',
      body: backendTypes.SceneUpdateEvent.encode({ scene: rawScene }).finish(),
    });
  }

  function sendSceneSwitch(id) {
    sendBackendMessage({
      type: 2,
      id: 0,
      name: 'SetCurrentScene',
      body: backendTypes.SceneId.encode({ id: String(id) }).finish(),
    });
  }

  async function buildSceneData(id) {
    //let ans = new Uint8Array(512);
    const document = await db.collection('scenes').findOne({ name: id });
    //console.log(document.stage.fixtures);
    let ans = hexStringToUint8Array(document.stage.fixtures);
    console.log(ans);
    return ans;
  }

  // Update current scene
app.post('/toggle-debug-mode', async (req, res) => {
  const decodedRequest = req.body;
  toggleButton = decodedRequest.buttonProperty;
});

// Update current scene
app.post('/update-current-scene', async (req, res) => {
  const decodedRequest = req.body;
  const newCurrentSceneId = decodedRequest.name;

  // Check if the new scene id is valid
  const newScene = await scenesCollection.findOne({ name: newCurrentSceneId });
  if (!newScene) {
    return res.status(400).send('Invalid scene id');
  }

  // Update the current scene ID in the database
  await setCurrentSceneId(db, newCurrentSceneId);
  await sendSceneUpdate(newCurrentSceneId,await buildSceneData(newCurrentSceneId));
  const response = protoTypes.UpdateCurrentSceneResponse.encode({}).finish();
  let emptyUniverse = new Uint8Array(512);
  universe = emptyUniverse;
  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});
// Add fixtures to scene
app.post('/add-fixtures-to-scene', async (req, res) => {
  // const fixtureIds = fixtureList;
  const currentSceneId = await getCurrentSceneId(db);
  // Check if scene exists
  const scene = await scenesCollection.findOne({ id: currentSceneId });
  if (!scene) {
    return res.status(404).send(`Scene with ID ${sceneName} not found`);
  }

  // Check if fixture ids are valid
  // const fixtures = await fixturesCollection.find({ id: { $in: fixtureIds } }).toArray();
  // if (fixtures.length !== fixtureIds.length) {
  //   return res.status(400).send('Some fixture ids are invalid');
  // }
  // Replace fixtures in the scene
  scene.stage.fixtures = universe;

  // Add fixtures to scene
  // const updatedScene = await scenesCollection.updateOne(
  //   { id: sceneId },
  //   { $addToSet: { 'stage.fixtures': { $each: fixtureIds } } }
  // );

  // const response = protoTypes.AddFixturesToSceneResponse.encode({}).finish();
  // res.set('Content-Type', 'application/octet-stream');
  // res.send(response);
});
// Get scene list
// app.get('/get-scene-list', async (req, res) => {
//   const scenes = await scenesCollection.find().toArray();
//   const response = protoTypes.GetSceneListResponse.encode({
//     scenes: scenes.map((scene) => ({ name: scene.name.toString() })),
//   }).finish();
  

//   res.set('Content-Type', 'application/octet-stream');
//   res.send(response);
// });
// Get scene list
app.get('/get-scene-list', async (req, res) => {
  const scenes = await scenesCollection.find().toArray();
  const response = scenes.map((scene) => ({ name: scene.name.toString() }));

  res.set('Content-Type', 'application/json');
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

  sendSceneSwitch(newSceneId);
  //sendSceneUpdate(newSceneId, await buildSceneData(newSceneId));
}

// Get current scene
app.get('/get-current-scene', async (req, res) => {
  const currentSceneId = await getCurrentSceneId(db);

  if (!currentSceneId) {
    res.status(404).send('Current scene not found');
    return;
  }

  const currentScene = await scenesCollection.findOne({ name: currentSceneId });

  if (currentScene) {
    const response = protoTypes.GetCurrentSceneResponse.encode({
      scene: String(currentScene.name),
    }).finish();

    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send('Current scene not found');
  }
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

      sendSceneUpdate(uuid, await buildSceneData(uuid));
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
  const decodedRequest = req.body;

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
  let emptyUniverse = new Uint8Array(512);
  newScene.stage.fixtures = emptyUniverse;
  await scenesCollection.insertOne(newScene);

  const response = protoTypes.CreateSceneResponse.encode({ scene: newScene }).finish();
  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});

// Delete a scene
app.post('/delete-scene', async (req, res) => {
  const decodedRequest = req.body;
  console.log(decodedRequest);
  const name = decodedRequest.scene.name; // Change 'uuid' to 'name'
  const existingScene = await scenesCollection.findOne({ name }); // Change '{ id: uuid }' to '{ name }'
  if (!existingScene) {
    res.status(404).send(`Scene with name ${name} not found`); // Change 'ID' to 'name' and 'uuid' to 'name'
    return;
  }

  const deletedResult = await scenesCollection.deleteOne({ name }); // Change '{ id: uuid }' to '{ name }'
  if (deletedResult.deletedCount > 0) {
    const response = protoTypes.DeleteSceneResponse.encode({ name }).finish(); // Change 'uuid' to 'name'
    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send(`Scene with name ${name} not found`); // Change 'ID' to 'name' and 'uuid' to 'name'
  }
});

// Create a new fixture
app.post('/light-queue', async (req, res) => {
  const decodedRequest = req.body;
  const fixtureData = decodedRequest.fixture;
  let data = objectToUint8Array(fixtureData.channels);
  setLightValues(fixtureData.id,data);
});

// Create a new fixture
app.get('/create-fixture', async(req,res)=>{
  //const decodedRequest = req.body;
  console.log("come in");
  const currentSceneId = await getCurrentSceneId(db);
  const scene = await scenesCollection.findOne({ name: currentSceneId });
  if (!scene) {
    return;
  }
  await scenesCollection.updateOne(
    { name: currentSceneId },
    { $set: { stage: {
      fixtures:universe,
    } } }
  );
  let emptyUniverse = new Uint8Array(512);
  universe = emptyUniverse;
  res.sendStatus(204);
  // const lastFixture = await fixturesCollection.find().sort({ id: -1 }).limit(1).toArray();
  // const newFixtureId = lastFixture.length > 0 ? lastFixture[0].id + 1 : 1; // <-- Change here
  // const newFixture = {
  //   id: newFixtureId,
  // };

  // const response = protoTypes.CreateFixtureResponse.encode({ fixture: newFixture }).finish();
  // res.set('Content-Type', 'application/octet-stream');
  // res.send(response);
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

//Black out
app.post('/blackout', async (req, res) => {
  const decodedRequest = req.body;
  console.log("blackout");
  const currentSceneId = await getCurrentSceneId(db);
  await setCurrentSceneId(db, 'blackout');
  
  await sendSceneUpdate('blackout',emptyUniverse);
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
}