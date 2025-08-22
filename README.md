# NFL Weekly Picks Application

A full-stack web application for NFL weekly pick'em pools with user management, real-time scoring, and leaderboards.

## Features

- **User Authentication**: JWT-based authentication with admin roles
- **NFL Game Data**: Integration with external APIs for schedules and scores
- **Weekly Picks**: Users make picks for each NFL game of the current week
- **Pick Locking**: Picks are locked once games start
- **Monday Night Tie-Breaker**: Score prediction for tie-breaking
- **Scoring System**: 1 point per correct pick + 3 bonus points for perfect weeks
- **Leaderboards**: Weekly and season-long leaderboards
- **Admin Panel**: User and pick management for administrators
- **Responsive Design**: Mobile-first design with Tailwind CSS

## Tech Stack

- **Frontend**: Angular 17+ with Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: SQLite with caching
- **Authentication**: JWT tokens
- **Deployment**: Docker container

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker (for containerized deployment)

### Development Setup

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd football_pool
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env file with your API keys and configuration
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   ```

4. **Initialize Database:**
   ```bash
   cd backend
   npm run migrate
   npm run seed
   ```

5. **Start Development Servers:**
   
   Backend (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```
   
   Frontend (Terminal 2):
   ```bash
   cd frontend
   npm start
   ```

6. **Access the application:**
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:3000

### Docker Deployment

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Application: http://localhost:3000

### Default Admin Account

After seeding the database:
- **Email**: admin@nflpicks.com
- **Password**: admin123

Sample user accounts (password: password123):
- john.doe@example.com
- jane.smith@example.com
- mike.wilson@example.com
- sarah.johnson@example.com

## API Configuration

### Required API Keys

1. **Ball Don't Lie API** (Optional - for real NFL data):
   - Sign up at: https://balldontlie.io
   - Add to .env: `BALLDONTLIE_API_KEY=your_api_key`

2. **TheSportsDB API** (Optional - for team logos):
   - Free tier available at: https://www.thesportsdb.com
   - Add to .env: `SPORTSDB_API_KEY=your_api_key`

*Note: The application includes mock data generators and will work without API keys for development and testing.*

## Database Schema

The application uses SQLite with the following main tables:
- `users` - User accounts and authentication
- `teams` - NFL team information
- `games` - NFL games and schedules  
- `picks` - User picks for games
- `weekly_scores` - Calculated weekly scores
- `weekly_winners` - Weekly winners and tie-breakers

## Environment Variables

### Backend (.env)

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:4200

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# API Keys (Optional)
BALLDONTLIE_API_KEY=your-balldontlie-api-key
SPORTSDB_API_KEY=your-sportsdb-api-key

# Database
DATABASE_PATH=./database.sqlite
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Games
- `GET /api/games/current` - Get current week games
- `GET /api/games/:season/:week` - Get specific week games
- `GET /api/games/teams` - Get all NFL teams

### Picks
- `GET /api/picks` - Get user's picks
- `POST /api/picks` - Submit pick
- `GET /api/picks/game/:gameId` - Get picks for specific game
- `GET /api/picks/history` - Get user's pick history

### Leaderboard
- `GET /api/leaderboard/weekly` - Weekly leaderboard
- `GET /api/leaderboard/season` - Season leaderboard
- `GET /api/leaderboard/winners` - Weekly winners
- `GET /api/leaderboard/stats` - User statistics

### Admin (Admin access required)
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:userId/role` - Update user role
- `GET /api/admin/picks` - Get all picks
- `PUT /api/admin/picks/:pickId` - Update pick
- `PUT /api/admin/games/:gameId/scores` - Update game scores

## Scoring Rules

1. **Regular Picks**: 1 point for each correct game pick
2. **Perfect Week Bonus**: +3 points for getting all picks correct in a week
3. **Tie-Breaker**: Monday Night Football total score prediction
4. **Weekly Winners**: Highest points for the week, ties broken by closest MNF prediction

## Development

### Project Structure

```
football_pool/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Custom middleware
│   ├── migrations/         # Database migrations
│   └── seeds/             # Database seed files
├── frontend/               # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/      # Core services, guards, interceptors
│   │   │   ├── features/   # Feature modules
│   │   │   └── shared/    # Shared components
│   │   └── environments/   # Environment configurations
└── docker/                # Docker configuration
```

### Adding New Features

1. **Backend**: Add routes in `/backend/src/routes/`, controllers in `/controllers/`, and business logic in `/services/`
2. **Frontend**: Create feature modules in `/frontend/src/app/features/`
3. **Database**: Add migrations in `/backend/migrations/` and update models

### Testing

Run tests for both frontend and backend:

```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test
```

## Production Deployment

### Docker Deployment

1. **Update environment variables** in `docker-compose.yml`
2. **Build and deploy**:
   ```bash
   docker-compose up -d --build
   ```

### Manual Deployment

1. **Build frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy backend** with built frontend files served as static content

3. **Set production environment variables**

4. **Run database migrations and seeds**

## Troubleshooting

### Common Issues

1. **Database not initializing**: Make sure to run `npm run migrate` and `npm run seed`
2. **CORS errors**: Check that `FRONTEND_URL` is set correctly in backend .env
3. **API key issues**: The app will work with mock data if API keys are not provided
4. **Port conflicts**: Change ports in package.json and environment files if needed

### Logs

- Backend logs: Available in console when running `npm run dev`
- Check Docker logs: `docker-compose logs -f`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Create an issue in the repository
