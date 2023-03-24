const express = require('express');
const { loadSync } = require('protobufjs');

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
  };

  app.use(express.raw({ type: 'application/octet-stream' }));

  app.post('/rpc', async (req, res) => {
    const requestBuffer = req.body;
    let response;
    let message;
  // Decode the incoming message based on its type
  try {
    message = RpcMessage.decode(requestBuffer);
  } catch (error) {
    console.error('Error while decoding RpcMessage:', error);
    res.status(400).send('Error while decoding RpcMessage');
  }

  switch (message.method) {
    case 'GetSceneList':
      response = RpcMessage.create({
        type: RpcType.values.RPC_TYPE_RESPONSE,
        id: message.id,
        method: message.method,
        body: GetSceneListResponse.encode({
          scenes: [],
        }).finish(),
      });
      break;
      case 'GetScene':
          const { scene } = GetSceneRequest.decode(message.body);
          response = RpcMessage.create({
            type: RpcType.values.RPC_TYPE_RESPONSE, 
            id: message.id,
            method: message.method,
            body: GetSceneResponse.encode({
              scene: {
                id: 'scene-id',
                name: 'Scene Name',
                external: false,
                stage: state,
              },
            }).finish(),
          });
          break;
      case 'SetScene':
          const { uuid, scene: sceneData } = SetSceneRequest.decode(message.body);
          if (sceneData.external) {
            response = RpcMessage.create({
              type: RpcType.values.RPC_TYPE_RESPONSE, 
              id: message.id,
              method: message.method,
              body: Buffer.from('Cannot change external scenes'),
            });
          } else {
            state = sceneData.stage;
            response = RpcMessage.create({
              type: RpcType.values.RPC_TYPE_RESPONSE, 
              id: message.id,
              method: message.method,
              body: SetSceneResponse.encode({
                scene: {
                  id: uuid,
                  name: sceneData.name,
                  external: sceneData.external,
                  stage: state,
                },
              }).finish(),
            });
          }
          break;
      case 'GetCurrentScene':
          response = RpcMessage.create({
            type: RpcType.values.RPC_TYPE_RESPONSE, 
            id: message.id,
            method: message.method,
            body: GetCurrentSceneResponse.encode({
              scene: {
                id: 'scene-id',
                name: 'Scene Name',
                external: false,
                stage: state,
              },
            }).finish(),
          });
          break;
      case 'SetFixture':
          const { scene: sceneId, fixture } = SetFixtureRequest.decode(message.body);
          const targetScene = state;
          const targetFixtureIndex = targetScene.fixtures.findIndex((f) => f.id === fixture.id);
          if (targetFixtureIndex === -1) {
            response = RpcMessage.create({
              type: RpcType.values.RPC_TYPE_RESPONSE, 
              id: message.id,
              method: message.method,
              body: Buffer.from(`Fixture with ID ${fixture.id} not found in scene ${sceneId}`),
            });
          } else if (targetScene.external) {
            response = RpcMessage.create({
              type: RpcType.values.RPC_TYPE_RESPONSE, 
              id: message.id,
              method: message.method,
              body: Buffer.from('Cannot modify fixtures in external scenes'),
            });
          } else {
            const newFixture = Fixture.create({
              type: RpcType.values.RPC_TYPE_RESPONSE,
              id: fixture.id,
              method: message.method,
              channels: fixture.channels,
            });
            targetScene.fixtures[targetFixtureIndex] = newFixture;
            response = RpcMessage.create({
              type: RpcType.values.RPC_TYPE_RESPONSE, 
              id: message.id,
              method: message.method,
              body: SetFixtureResponse.encode({
                fixture: newFixture,
              }).finish(),
            });
          }
          break;
      default:
          response = RpcMessage.create({
            type: RpcType.values.RPC_TYPE_RESPONSE, 
            id: message.id,
            method: message.method,
            body: Buffer.from(`Unknown method ${message.method}`),
          });
        }
        
        res.set('Content-Type', 'application/octet-stream');
        res.send(RpcMessage.encode(response).finish());
        });
        app.listen(port, () => {
          console.log(`Server listening on port ${port}`);
          });
        }
