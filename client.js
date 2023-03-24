const { load } = require('protobufjs');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3000/rpc';

let RpcMessage;
let RpcType;
let GetSceneListResponse;
let GetSceneResponse;
let SetSceneResponse;

async function run() {
  const root = await load('stage.proto');
  RpcMessage = root.lookupType('stage.v1.RpcMessage');
  RpcType = root.lookupEnum('stage.v1.RpcType');
  const GetSceneListRequest = root.lookupType('stage.v1.GetSceneListRequest');
  GetSceneListResponse = root.lookupType('stage.v1.GetSceneListResponse');


  const GetSceneRequest = root.lookupType('stage.v1.GetSceneRequest');
  GetSceneResponse = root.lookupType('stage.v1.GetSceneResponse');

  const getSceneRequest = GetSceneRequest.create({ scene: 'scene-id' });
  const rpcMessageGetScene = RpcMessage.create({
    type: RpcType.RPC_TYPE_REQUEST,
    id: 2,
    method: 'GetScene',
    body: GetSceneRequest.encode(getSceneRequest).finish(),
  });

  await sendRequest(rpcMessageGetScene);

  // Test SetScene request
  const SetSceneRequest = root.lookupType('stage.v1.SetSceneRequest');
  SetSceneResponse = root.lookupType('stage.v1.SetSceneResponse');

  const setSceneRequest = SetSceneRequest.create({
    uuid: 'new-scene-id',
    scene: {
      name: 'New Scene',
      external: false,
      stage: {
        fixtures: [
          {
            id: 1,
            channels: Uint8Array.from([0, 0, 255, 255, 255, 255]),
          },
        ],
      },
    },
  });

  const rpcMessageSetScene = RpcMessage.create({
    type: RpcType.RPC_TYPE_REQUEST,
    id: 3,
    method: 'SetScene',
    body: SetSceneRequest.encode(setSceneRequest).finish(),
  });

  await sendRequest(rpcMessageSetScene);


  const getSceneListRequest = GetSceneListRequest.create();
  const rpcMessage = RpcMessage.create({
    type: RpcType.RPC_TYPE_REQUEST,
    id: 1,
    method: 'GetSceneList',
    body: GetSceneListRequest.encode(getSceneListRequest).finish(),
  });

  await sendRequest(rpcMessage);
}

async function sendRequest(rpcMessage) {
  try {
    const encodedRpcMessage = RpcMessage.encode(rpcMessage).finish();
    const response = await axios.post(SERVER_URL, encodedRpcMessage, {
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    const responseData = new Uint8Array(response.data);
    const responseRpcMessage = RpcMessage.decode(responseData);
    console.log('responseRpcMessage:', responseRpcMessage);

    if (responseRpcMessage.type === RpcType.values.RPC_TYPE_RESPONSE) {
      let responseBody;
      switch (responseRpcMessage.method) {
        case 'GetSceneList':
          responseBody = responseRpcMessage.body.length ? GetSceneListResponse.decode(responseRpcMessage.body) : { scenes: [] };
          break;
        case 'GetScene':
          responseBody = responseRpcMessage.body.length ? GetSceneResponse.decode(responseRpcMessage.body) : { scene: {} };
          break;
        case 'SetScene':
          responseBody = responseRpcMessage.body.length ? SetSceneResponse.decode(responseRpcMessage.body) : { scene: {} };
          break;
        default:
          throw new Error(`Unknown method ${responseRpcMessage.method}`);
      }
      console.log('Received response:', responseRpcMessage, 'with decoded body:', responseBody);
    } else if (responseRpcMessage.type === RpcType.values.RPC_TYPE_RESPONSE_ERROR) {
      console.error('Error response:', responseRpcMessage);
    } else {
      console.error('Unexpected response:', responseRpcMessage);
    }
  } catch (error) {
    console.error('Error while sending request:', error);
  }
}

run().catch((err) => console.log(err));