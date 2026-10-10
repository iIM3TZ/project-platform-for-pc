# pc-parts-compare

A web platform that compares PC part prices across online stores in Saudi Arabia and helps users build a PC.

## Requirements
- Node.js 18+

## Run locally
```bash
npm install
cp .env.example .env
npm run dev     # development (auto-restart with nodemon)
npm start       # production
```

Then open http://localhost:3000/pages/index.html

Health check: `GET http://localhost:3000/api/health` → `{ "data": { "status": "ok" } }`
