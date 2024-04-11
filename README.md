# giggle-grove

Chatprogramm für verteilte Systeme

# Docker Builddo

- Dev
  - docker build --tag giggle-grove:1.0 .
  - docker run -d -p 6969:6969 giggle-grove:1.0

# Installation

- cd backend && yarn install
- pip install websocket-client

# Start

1. cd backend && yarn start
2. cd socket-chat && python.exe client.py
