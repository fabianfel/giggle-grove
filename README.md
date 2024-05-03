# giggle-grove

Chatprogramm für verteilte Systeme

# Installation auf Raspberry PI

```bash
# Löschen aller vorherigen Images
docker rmi $(docker images 'giggle-grove' -a -q)

# Ausführen des Docker Containers im detached Mode
# Bei diesem Container darf der Port nicht geändert werden, da sonst die interne Produktionskonfiguration nicht weiter funktioniert 
docker run -p 0.0.0.0:6969:6969 -d fabianfel/public:giggle-grove
```

# Lokales Setup
## Backend
```bash
# Zu Backend navigieren
cd backend

# Installation der Dependencies
yarn install

# Für den Start des Backends (Anwendung wird Standardmäßig unter Port 6969 gestartet)
yarn start

# Optional können Sie auch einen anderen Port zum Start angeben (<PORT> Placeholder durch Port ersetzen) (Standardmäßig werden Port 6969, 6970 und 6971 unterstützt für das lokale Setup)
yarn start <PORT>

# Falls Sie das Backend gemeinsam mit dem Frontend kompilieren und ausführen wollen
yarn start:all
```
## Frontend
```bash
# Zu Frontend navigieren
cd frontend

# Installation der Dependencies
yarn install

# Start des Frontends (Anwendung wird unter Port 4200 gestartet)
yarn start
```

# Stoppen der Anwendungen
## Backend
command line interrupt (CTRL + C)
## Frontend
command line interrupt (CTRL + C)

# Testing
## Frontend
```bash
# Zu Frontend navigieren
cd frontend

# Starten der Frontend-Tests
yarn test
```
Coverage wird abgelegt unter: frontend\coverage\index.html
