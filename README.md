# giggle-grove

Chatprogramm für verteilte Systeme

# Docker Build

- Dev
  - docker build --tag chat:1.0.0 .
- Prod
  - Make sure, that your runner is supporting linux/arm64!
  - docker buildx build --platform "linux/arm64" --output type=local,dest=chat_arm64.tar --tag chat:1.0.0 .

# Installation

- cd backend && yarn install
- pip install websocket-client

# Start

1. cd backend && yarn start
2. cd socket-chat && python.exe client.py
