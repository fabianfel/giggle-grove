const port = 5000;

export const config = {
  production: false,
  apiPort: port,
  websocketUrl: 'ws://localhost:' + port + '/socket',
  apiUrl: 'http://localhost:' + port + '/api',
};
