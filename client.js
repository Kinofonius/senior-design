const axios = require('axios');
const { loadSync } = require('protobufjs');

function loadProtoTypes() {
  const root = loadSync('stage.proto');
  return {
    GetSceneListResponse: root.lookupType('stage.v1.GetSceneListResponse'),
    GetSceneResponse: root.lookupType('stage.v1.GetSceneResponse'),
    GetSceneResponse2: root.lookupType('stage.v1.GetSceneResponse'),
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
  };
}

const protoTypes = loadProtoTypes();

async function testEndpoints() {
  const serverUrl = 'http://192.168.31.204:3000';

  try {
    // Test /get-scene-list endpoint
    const getSceneListResponse = await axios.get(`${serverUrl}/get-scene-list`, {
      responseType: 'arraybuffer',
    });
    const getSceneListResponseData = protoTypes.GetSceneListResponse.decode(
      getSceneListResponse.data
    );
    console.log('get-scene-list response:', getSceneListResponseData);

    // Test /get-scene/:sceneId endpoint
    const getSceneResponse = await axios.get(`${serverUrl}/get-scene/2`, {
      responseType: 'arraybuffer',
    });
    const getSceneResponseData = protoTypes.GetSceneResponse.decode(getSceneResponse.data);
    console.log('get-scene response:', JSON.stringify(getSceneResponseData, null, 2));

    // Test /get-current-scene endpoint
    const getCurrentSceneResponse = await axios.get(`${serverUrl}/get-current-scene`, {
      responseType: 'arraybuffer',
    });
    const getCurrentSceneResponseData = protoTypes.GetCurrentSceneResponse.decode(
      getCurrentSceneResponse.data
    );
    console.log('get-current-scene response:', getCurrentSceneResponseData);

    // Test /set-scene endpoint
    const setSceneRequest = {
      uuid: 1,
      scene: {
        name: 'New Scene',
        external: false,
        stage: {
          fixtures: [
            {
              id: 1,
              channels: [255, 255, 255, 0, 0, 0],
            },
            {
              id: 2,
              channels: [0, 255, 0, 255, 0, 0],
            },
            {
              id: 3,
              channels: [0, 0, 255, 0, 0, 255],
            },
          ],
        },
      },
    };
    const encodedSetSceneRequest = protoTypes.SetSceneRequest.encode(setSceneRequest).finish();
    const setSceneResponse = await axios.post(`${serverUrl}/set-scene`, encodedSetSceneRequest, {
      headers: { 'Content-Type': 'application/octet-stream' },
      responseType: 'arraybuffer',
    });
    const setSceneResponseData = protoTypes.SetSceneResponse.decode(setSceneResponse.data);
    console.log('set-scene response:', setSceneResponseData);

    // Test /set-fixture endpoint
    const setFixtureRequest = {
      scene: 1,
      fixture: {
        id: 1,
        channels: [255, 0, 0, 0, 0, 0],
      },
    };

    const encodedSetFixtureRequest = protoTypes.SetFixtureRequest.encode(setFixtureRequest).finish();
    const setFixtureResponse = await axios.post(`${serverUrl}/set-fixture`, encodedSetFixtureRequest, {
      headers: { 'Content-Type': 'application/octet-stream' },
      responseType: 'arraybuffer',
    });
    const setFixtureResponseData = protoTypes.SetFixtureResponse.decode(setFixtureResponse.data);
    console.log('set-fixture response:', setFixtureResponseData);

    // Test /set-scene endpoint with a scene that has a large number of fixtures
const largeSetSceneRequest = {
  uuid: 1,
  scene: {
    name: 'Large Scene',
    external: false,
    stage: {
      fixtures: [],
    },
  },
};

for (let i = 0; i < 1000; i++) {
  largeSetSceneRequest.scene.stage.fixtures.push({
    id: i,
    channels: [255, 255, 255, 0, 0, 0],
  });
}
const encodedLargeSetSceneRequest = protoTypes.SetSceneRequest.encode(largeSetSceneRequest).finish();
const largeSetSceneStartTime = Date.now();
const largeSetSceneResponse = await axios.post(`${serverUrl}/set-scene`, encodedLargeSetSceneRequest, {
  headers: { 'Content-Type': 'application/octet-stream' },
  responseType: 'arraybuffer',
});
const largeSetSceneResponseData = protoTypes.SetSceneResponse.decode(largeSetSceneResponse.data);
const largeSetSceneEndTime = Date.now();
console.log(`set-scene response time for large payload: ${largeSetSceneEndTime - largeSetSceneStartTime}ms`);
console.log('large set-scene response:', largeSetSceneResponseData);
    // Test /get-scene/:sceneId endpoint
    const getSceneResponse2 = await axios.get(`${serverUrl}/get-scene/1`, {
      responseType: 'arraybuffer',
    });
    const getSceneResponseData2 = protoTypes.GetSceneResponse.decode(getSceneResponse2.data);
    console.log('get-scene response:', JSON.stringify(getSceneResponseData2, null, 2));
// Test /create-scene endpoint
const createSceneRequest = {
  scene: {
    name: 'New Scene',
    external: false,
    stage: {
      fixtures: [255, 255, 255, 0, 0, 0],
    },
  },
};
const encodedCreateSceneRequest = protoTypes.CreateSceneRequest.encode(createSceneRequest).finish();
const createSceneResponse = await axios.post(`${serverUrl}/create-scene`, encodedCreateSceneRequest, {
  headers: { 'Content-Type': 'application/octet-stream' },
  responseType: 'arraybuffer',
});
const createSceneResponseData = protoTypes.CreateSceneResponse.decode(createSceneResponse.data);
console.log('create-scene response:', createSceneResponseData);

// Test /delete-scene endpoint
// const deleteSceneRequest = {
//   uuid: 1,
// };
// const encodedDeleteSceneRequest = protoTypes.DeleteSceneRequest.encode(deleteSceneRequest).finish();
// const deleteSceneResponse = await axios.post(`${serverUrl}/delete-scene`, encodedDeleteSceneRequest, {
//   headers: { 'Content-Type': 'application/octet-stream' },
//   responseType: 'arraybuffer',
// });
// const deleteSceneResponseData = protoTypes.DeleteSceneResponse.decode(deleteSceneResponse.data);
// console.log('delete-scene response:', deleteSceneResponseData);
// Test /create-fixture endpoint
const createFixtureRequest = {
  scene: 1,
  fixture: {
    id: 1,
    channels: [255, 0, 0, 0, 0, 0],
  },
};

const encodedCreateFixtureRequest = protoTypes.CreateFixtureRequest.encode(createFixtureRequest).finish();
const createFixtureResponse = await axios.post(`${serverUrl}/create-fixture`, encodedCreateFixtureRequest, {
  headers: { 'Content-Type': 'application/octet-stream' },
  responseType: 'arraybuffer',
});
const createFixtureResponseData = protoTypes.CreateFixtureResponse.decode(createFixtureResponse.data);
console.log('create-fixture response:', createFixtureResponseData);

// Test /delete-fixture endpoint
const deleteFixtureRequest = {
  id: 1,
};

const encodedDeleteFixtureRequest = protoTypes.DeleteFixtureRequest.encode(deleteFixtureRequest).finish();
const deleteFixtureResponse = await axios.post(`${serverUrl}/delete-fixture`, encodedDeleteFixtureRequest, {
  headers: { 'Content-Type': 'application/octet-stream' },
  responseType: 'arraybuffer',
});
const deleteFixtureResponseData = protoTypes.DeleteFixtureResponse.decode(deleteFixtureResponse.data);
console.log('delete-fixture response:', deleteFixtureResponseData);

}catch (error) {
  console.error('Error:', error.message);
}
}
testEndpoints();