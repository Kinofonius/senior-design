const express = require('express');
const { loadSync } = require('protobufjs');
const os = require('os');

const app = express();
const port = 3000;

run().catch((err) => console.log(err));

async function run() {
  const root = loadSync('stage.proto');
  // const ControlService = root.lookupService('stage.v1.ControlService');
  const Scene = root.lookupType('stage.v1.Scene');
  const Fixture = root.lookupType('stage.v1.Fixture');
  const GetSceneListRequest = root.lookupType('stage.v1.GetSceneListRequest');
  const GetSceneListResponse = root.lookupType('stage.v1.GetSceneListResponse');
  const GetSceneRequest = root.lookupType('stage.v1.GetSceneRequest');
  const GetSceneResponse = root.lookupType('stage.v1.GetSceneResponse');
  const SetSceneRequest = root.lookupType('stage.v1.SetSceneRequest');
  const SetSceneResponse = root.lookupType('stage.v1.SetSceneResponse');
  const GetCurrentSceneRequest = root.lookupType('stage.v1.GetCurrentSceneRequest');
  const GetCurrentSceneResponse = root.lookupType('stage.v1.GetCurrentSceneResponse');
  const SetCurrentSceneRequest = root.lookupType('stage.v1.SetCurrentSceneRequest');
  const SetCurrentSceneResponse = root.lookupType('stage.v1.SetCurrentSceneResponse');
  const GetStateRequest = root.lookupType('stage.v1.GetStateRequest');
  const GetStateResponse = root.lookupType('stage.v1.GetStateResponse');
  const SetFixtureRequest = root.lookupType('stage.v1.SetFixtureRequest');
  const SetFixtureResponse = root.lookupType('stage.v1.SetFixtureResponse');
  const RpcMessage = root.lookupType('stage.v1.RpcMessage');
  const RpcType = root.lookupEnum('stage.v1.RpcType');

  // Simulated data
  let state = {
    currentSceneId: 1,
    fixtures: [
      {
        id: 1,
        channels: Uint8Array.from([0, 0, 0, 255, 255, 255]),
      },
      {
        id: 2,
        channels: Uint8Array.from([255, 0, 0, 0, 255, 0]),
      },
      {
        id: 3,
        channels: Uint8Array.from([0, 255, 0, 0, 0, 255]),
      },
    ],
    scenes: [
      {
        name: 1,
        id: 1,
        external: false,
        fixture: 1
      },
      {
        name: 2,
        id: 2,
        external: false,
        fixture: 2
      },
    ],
  };
  app.use(express.raw({ type: 'application/octet-stream' }));

app.get('/get-scene-list', async (req, res) => {
  const response = GetSceneListResponse.encode({
    scenes: state.scenes.map((scene) => scene.name.toString()),
  }).finish();

  res.set('Content-Type', 'application/octet-stream');
  res.send(response);
});

app.get('/get-scene/:sceneId', async (req, res) => {
  const sceneId = parseInt(req.params.sceneId);
  const scene = state.scenes.find((scene) => scene.id === sceneId);

  if (scene) {
    // console.log('scene.name type:', typeof scene.name); // Check the type of scene.name
    // console.log('String(scene.name) type:', typeof String(scene.name)); // Check the type of String(scene.name)
    const response = GetSceneResponse.encode({
      scene: {
        id: scene.id,
        name: String(scene.name),
        external: scene.external,
        stage: {
          fixtures: state.fixtures,
        },
      },
    }).finish();

    res.set('Content-Type', 'application/octet-stream');
    res.send(response);
  } else {
    res.status(404).send('Scene not found');
  }
});
  
  app.get('/get-current-scene', async (req, res) => {
    const currentScene = state.scenes.find((scene) => scene.id === state.currentSceneId);
  
    if (currentScene) {
      const response = GetCurrentSceneResponse.encode({
        scene: String(state.currentSceneId),
      }).finish();
  
      res.set('Content-Type', 'application/octet-stream');
      res.send(response);
    } else {
      res.status(404).send('Current scene not found');
    }
  });
  
  app.post('/set-scene', async (req, res) => {
    const decodedRequest = SetSceneRequest.decode(req.body);
    const { uuid, scene: sceneData } = decodedRequest;
  
    if (sceneData.external) {
      res.status(400).send('Cannot change external scenes');
    } else {
      const sceneIndex = state.scenes.findIndex((scene) => scene.id === uuid);
      // console.log((scene) => scene.id);
      if (sceneIndex !== -1) {
        state.scenes[sceneIndex] = {
          id: uuid,
          name: String(sceneData.name),
          external: sceneData.external,
          fixture: sceneData.fixture,
        };
  
        const response = SetSceneResponse.encode({
          scene: state.scenes[sceneIndex],
        }).finish();
        res.set('Content-Type', 'application/octet-stream');
        res.send(response);
      } else {
        res.status(404).send(`Scene with ID ${uuid} not found`);
      }
    }
  });

  app.post('/set-fixture', async (req, res) => {
    const decodedRequest = SetFixtureRequest.decode(req.body);
    const { scene: sceneId, fixture } = decodedRequest;
    const targetScene = state.scenes.find((scene) => scene.id === parseInt(sceneId));
    // console.log(sceneId);
    // console.log((scene) => scene.id);
    if (!targetScene) {
      res.status(404).send(`Scene with ID ${sceneId} not found`);
      console.log('Scene with ID ${sceneId} not found');
    } else if (targetScene.external) {
      res.status(400).send('Cannot modify fixtures in external scenes');
    } else {
      const targetFixtureIndex = state.fixtures.findIndex((f) => f.id === fixture.id);
  
      if (targetFixtureIndex === -1) {
        res.status(400).send(`Fixture with ID ${fixture.id} not found in scene ${sceneId}`);
      } else {
        const newFixture = {
          id: fixture.id,
          channels: fixture.channels,
        };
        console.log(fixture.channels);
        state.fixtures[targetFixtureIndex] = newFixture;
        const response = SetFixtureResponse.encode({
          fixture: newFixture,
        }).finish();
        // console.log(newFixture);
        res.set('Content-Type', 'application/octet-stream');
        res.send(response);
      }
    }
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