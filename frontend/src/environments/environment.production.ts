const port = 5000;
// const port = 48214,

export const config = {
  production: false,
  apiPort: port,
  websocketUrl: 'ws://localhost:' + port + '/socket',
  apiUrl: 'http://localhost:' + port + '/api',
};
