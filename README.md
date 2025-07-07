# EAFC Draft Application

A modern web application for organizing EA FC (FIFA) player drafts with real-time updates, tournament management, and comprehensive player data. Try now at https://fifadraft.kak.dev


https://github.com/user-attachments/assets/a660d31d-2fc8-4846-9aa7-08b1ff5f12cb


https://github.com/user-attachments/assets/911c3090-2a66-4704-8b4b-e4b8c87f33f4


https://github.com/user-attachments/assets/aaf14e05-27dd-4436-b592-9f5cf9b2f47e


## 🎯 Main Features

### Draft Management

- **Create Drafts**: Generate unique draft rooms with custom names and admin controls
- **Real-time Drafting**: Live WebSocket updates for instant pick notifications
- **Player Walkout Animations**: Celebratory animations when players are selected
- **Draft Order Management**: Automatic participant shuffling and turn-based picking
- **Shortlist System**: Save favorite players for quick access during drafts

### Player Database

- **Comprehensive Player Data**: 18,000+ EA FC players with detailed stats
- **Advanced Search**: Filter by position, rating, league, nationality, and more
- **Player Comparison**: Side-by-side stats comparison for informed decisions
- **Player Details**: Complete player profiles with abilities, stats, and images

### Tournament System

- **Post-Draft Tournaments**: Automatic tournament generation after draft completion
- **Match Recording**: Track wins, losses, and draws with score tracking
- **Live Standings**: Real-time tournament table with points, goal difference, and rankings

## 🏗️ Architecture & Tech Stack

### Frontend

- **React 19** with TypeScript for type-safe development
- **Vite** for fast development and optimized builds
- **Tailwind CSS 4** for modern, responsive styling
- **ShadcnUI** for accessible, unstyled components
- **React Router** for client-side routing
- **WebSocket** for real-time communication

### Backend

- **Go 1.24** with high-performance HTTP server
- **Gorilla WebSocket** for real-time bidirectional communication
- **SQLx** for type-safe database operations
- **PostgreSQL 17** for reliable data persistence
- **RESTful API** with JSON responses

### Infrastructure

- **Docker & Docker Compose** for containerized development and deployment
- **Google Cloud Platform** for production hosting
- **Caddy** for reverse proxy and SSL termination
- **Python Scraper** for player data collection from EA's API

## 📁 Project Structure

```
eafc-draft/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── context/       # React context providers
│   │   ├── lib/           # API utilities and helpers
│   │   └── assets/        # Static assets
│   ├── package.json       # Frontend dependencies
│   └── vite.config.ts     # Vite configuration
├── server/                # Go backend application
│   ├── cmd/server/        # Application entry point
│   ├── internal/
│   │   ├── api/           # HTTP handlers and WebSocket logic
│   │   ├── config/        # Configuration management
│   │   └── database/      # Database models and queries
│   ├── go.mod             # Go dependencies
│   └── Dockerfile         # Backend container configuration
├── scraper/               # Python player data scraper
│   ├── scraper.py         # EA FC API scraper
│   ├── eafc_players.csv   # Scraped player data
│   └── pyproject.toml     # Python dependencies
├── docker-compose.yml     # Development environment
├── docker-compose.prod.yml # Production environment
├── Caddyfile             # Reverse proxy configuration
├── Makefile              # Development commands
├── deploy.sh             # Production deployment script
└── README.md             # This file
```

## 🚀 Development Setup

### Prerequisites

- **Docker & Docker Compose** for containerized services
- **Node.js 18+** for frontend development
- **Go 1.24+** for backend development (optional, Docker handles this)
- **Python 3.10+** for scraper (optional)

### 1. Environment Configuration

#### Backend Environment

Create `.env` file in the root directory:

```bash
cp env.example .env
```

Required variables:

```env
POSTGRES_DB=eafc_draft
POSTGRES_USER=eafc_user
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgres://eafc_user:your_secure_password@localhost:5432/eafc_draft?sslmode=disable
SERVER_ADDRESS=:8080
ALLOWED_ORIGIN=http://localhost:5173
```

#### Frontend Environment

Create `client/.env.local`:

```bash
cp client/env.example client/.env.local
```

Required variables:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_BASE_URL=ws://localhost:8080
```

### 2. Database Setup

Start the PostgreSQL database:

```bash
# Create Docker volume for persistent data
docker volume create eafc-draft-data

# Start database only
docker compose up database -d
```

### 3. Player Data Import

Import the player database:

```bash
# Navigate to scraper directory
cd scraper

# Install Python dependencies
uv sync

# Run the scraper to get latest player data
uv run python scraper.py

# Import data to database (run from project root)
docker compose exec database psql -U eafc_user -d eafc_draft -c "\copy players FROM '/scraper/eafc_players.csv' WITH (FORMAT csv, HEADER true);"
```

### 4. Start Development Environment

```bash
# Start all services (database + backend)
make dev-server

# In another terminal, start frontend
make dev-client
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080/api
- **Database**: localhost:5432 (PostgreSQL)

## 🛠️ Development Commands

```bash
# Show all available commands
make help

# Start backend services
make dev-server

# Start frontend development
make dev-client

# Deploy to production
make deploy
```

## 🚀 Production Deployment

### Google Cloud Platform Deployment

The application is configured for deployment on Google Cloud Platform with the following setup:

1. **VM Instance**: Compute Engine VM with Docker support
2. **Domain**: Custom domains with SSL certificates via Caddy
3. **Database**: PostgreSQL running in Docker container
4. **Reverse Proxy**: Caddy for SSL termination and routing

### Deployment Steps

1. **Prepare Production Environment**:

   ```bash
   # Create production environment file
   cp env.example .env.prod
   # Edit .env.prod with production values
   ```

2. **Deploy to GCP**:

   ```bash
   make deploy
   ```

3. **Verify Deployment**:
   ```bash
   # Check container status
   gcloud compute ssh eafc-draft-vm --zone=europe-west3-a --command="sudo docker compose -f docker-compose.prod.yml ps"
   ```

### Production URLs

- **Frontend**: https://fifadraft.kak.dev
- **Backend API**: https://fifadraftapi.kak.dev

## 📊 API Endpoints

### Draft Management

- `POST /api/drafts` - Create new draft
- `GET /api/drafts/{code}` - Get draft details
- `POST /api/drafts/{code}/join` - Join existing draft
- `POST /api/drafts/{code}/start` - Start draft (admin only)
- `POST /api/drafts/{code}/tournament` - Start tournament (admin only)

### Player Operations

- `GET /api/players` - List players with filters
- `GET /api/players/{id}` - Get player details
- `POST /api/drafts/{code}/picks` - Make player pick

### Tournament Operations

- `GET /api/drafts/{code}/tournament` - Get tournament data
- `POST /api/drafts/{code}/matches` - Record match result

### WebSocket Events

- `draft_joined` - Participant joined draft
- `pick_made` - Player selected
- `draft_started` - Draft began
- `tournament_started` - Tournament began
- `match_recorded` - Match result recorded

**Built with ❤️ by a bunch of friends who spent too many hours playing FIFA**
