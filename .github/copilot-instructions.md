# NFL Picks Application - AI Copilot Instructions

## Architecture Overview

This is a **single-container NFL picks application** with Angular 17 standalone components, Express.js backend, SQLite database, and Docker deployment targeting self-hosted runners.

### Key Architectural Decisions
- **Single container deployment**: Frontend built at Docker build time and served as static files from `backend/public/`
- **SQLite with volume persistence**: Database stored in `./data/database.sqlite` with Docker volume mount `./data:/app/data:Z`
- **Embedded database initialization**: No migrations - schema created via `initializeDatabase()` in `backend/src/models/database.js`
- **Production seed prevention**: `seed.js` only runs in development (`NODE_ENV=development`), never in production deployments
- **Standalone Angular components**: No NgModules - all components use `standalone: true` with explicit imports

## Critical Data Protection Patterns

**NEVER run seed scripts in production deployments** - this was the source of major data loss incidents. The Dockerfile CMD checks:
```bash
if [ "$NODE_ENV" = "development" ] && [ ! -f /app/data/database.sqlite ]; then node seeds/seed.js; fi
```

**Database wrapper pattern**: All DB operations use wrapped functions from `database.js`:
- `getQuery()` - single row SELECT with parameter binding
- `getAllQuery()` - multiple rows SELECT with parameter binding  
- `runQuery()` - INSERT/UPDATE/DELETE with parameter binding
- **Never use raw SQL concatenation** - always use parameterized queries

**Volume mount timing**: Container startup waits for volume mount before database operations. Health checks at `/api/auth/health` return user count for deployment verification.

**Google Drive backup integration** (`scripts/backup-to-gdrive.sh`):
```bash
# Daily backups with 7-day rotation
rclone copy /path/to/database.sqlite gdrive:nfl-picks-backups/daily/
# Weekly backups with 4-week rotation  
rclone copy /path/to/database.sqlite gdrive:nfl-picks-backups/weekly/
```

## NFL Data Integration Patterns

**Rate-limited API service**: `backend/src/services/nfl-api.js` implements sliding-window rate limiting (5 calls/minute) for Ball Don't Lie API:
```javascript
_allowAndRecordApiCall() {
  const now = Date.now();
  const windowMs = 60 * 1000; // 60 seconds
  this.apiRequestTimestamps = this.apiRequestTimestamps.filter(t => (now - t) <= windowMs);
  if (this.apiRequestTimestamps.length >= this.rateLimit) return false;
  this.apiRequestTimestamps.push(now);
  return true;
}
```

**Multi-layer caching strategy**:
- Database cache (`api_cache` table) with TTL expiration
- In-memory cache with configurable TTL
- Mock data fallbacks when `NO_MOCK_DATA=false`
- Static team logo files served from `backend/public/team-logos/`

**Game state management**: Games have `status` field (`scheduled`, `in_progress`, `final`) that controls pick locking and scoring triggers. Live updates track `quarter_time_remaining` and `live_status`.

**Team logo service patterns** (`backend/src/services/team-logo.service.js`):
- **TheSportsDB API integration** with rate limiting (30 requests/minute)
- **Local file caching** in `backend/public/team-logos/[team]_logo.png`
- **Fallback chain**: Cached file → TheSportsDB API → ESPN CDN
- **Team abbreviation mapping** from NFL codes to full team names

## Authentication & Security Patterns

**JWT with BehaviorSubject**: `frontend/src/app/core/services/auth.service.ts` uses reactive patterns:
```typescript
private currentUserSubject = new BehaviorSubject<User | null>(null);
public currentUser$ = this.currentUserSubject.asObservable();

// Token refresh pattern
refreshToken(): Observable<any> {
  return this.http.post(`${this.baseUrl}/refresh-token`, {})
    .pipe(tap(response => this.setSession(response)));
}
```

**Route guards**: `auth.guard.ts` checks authentication, admin routes check `is_admin` flag. Uses modern functional guards:
```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isAuthenticated()) return true;
  router.navigate(['/auth']);
  return false;
};
```

**HTTP interceptor chain**: `auth.interceptor.ts` automatically adds JWT headers and handles 401 responses

**Middleware chain**: `backend/src/middleware/auth.js` validates JWT and populates `req.user`

## Angular 17 Frontend Patterns

**Standalone component architecture**: All components use `standalone: true` with explicit imports:
```typescript
@Component({
  selector: 'app-picks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavigationComponent],
  template: `...`
})
export class PicksComponent implements OnInit {
  private gameService = inject(GameService);
  private pickService = inject(PickService);
}
```

**Service injection patterns**: Use modern `inject()` function instead of constructor injection:
```typescript
// Modern pattern
private authService = inject(AuthService);
private router = inject(Router);

// Instead of constructor injection
constructor(private authService: AuthService, private router: Router) {}
```

**Reactive forms with auto-save**: 
```typescript
// Form value changes trigger auto-save with debounce
this.picksForm.valueChanges.subscribe(() => {
  if (!this.loading) {
    setTimeout(() => this.autoSavePicks(), 1000);
  }
});
```

**Image fallback patterns**: Team logos with ESPN CDN fallback:
```typescript
handleImageError(event: Event, teamAbbreviation: string): void {
  const imgElement = event.target as HTMLImageElement;
  imgElement.src = `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbreviation?.toUpperCase()}.png`;
}
```

## Backend Controller→Service→Database Patterns

**Controller responsibility pattern** (e.g., `backend/src/controllers/games.js`):
```javascript
const getCurrentWeekGames = async (req, res) => {
  try {
    // 1. Get current week from NFL API service
    const { week, season } = nflApiService.getCurrentWeek();
    
    // 2. Try database first
    let games = await getAllQuery(`SELECT ... WHERE week = ? AND season = ?`, [week, season]);
    
    // 3. Fallback to API if empty
    if (games.length === 0) {
      await nflApiService.fetchWeekSchedule(week, season);
      games = await getAllQuery(...); // Try again
    }
    
    // 4. Transform data for frontend
    res.json({ week, season, games: games.map(transformGame) });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to get games' });
  }
};
```

**Service layer responsibility**: Services handle external API calls, data transformation, and business logic
**Database layer responsibility**: Database wrapper provides parameterized query interface

## Deployment & CI/CD Patterns

**Self-hosted GitHub Actions**: `.github/workflows/deploy-self-hosted.yml` runs on self-hosted runner with:
- **Pre-deployment backups**: Local SQLite + Google Drive upload
- **Health check validation**: `/api/auth/health` endpoint returns user count > 0
- **Emergency restoration procedures**: Automatic rollback on health check failure
- **Container startup timing**: 35-second wait + 5 retry attempts for database initialization
- **SSH key configuration**: Self-hosted runner accesses deployment server via SSH

**Multi-environment backup strategy**:
```bash
# Local backup before deployment
cp data/database.sqlite "backups/nfl-picks-db-$(date +'%Y%m%d_%H%M%S').sqlite"

# Google Drive backup via rclone
rclone copy data/database.sqlite gdrive:nfl-picks-backups/daily/

# Backup retention: 7 daily + 4 weekly + 6 monthly
```

**Docker build context exclusions**: `.dockerignore` excludes `data/` directory to prevent build conflicts

**Production port mapping**: Development uses `:3000` and `:4200`, production uses single port `:3001`

## Development Workflows

**Local development environment**:
```bash
# Backend development server (auto-restart)
cd backend && npm run dev

# Frontend development server (live reload)
cd frontend && npm start

# Database reset with seed data
rm backend/database.sqlite && cd backend && npm run seed
```

**Testing deployment locally**:
```bash
# Build and run production container
docker-compose down && docker-compose up --build -d

# Verify deployment health
curl http://localhost:3001/api/auth/health
# Expected response: {"status":"ok","user_count":9,"database_connected":true}
```

**Data recovery procedures**:
```bash
# Emergency database restoration
docker-compose down
cp backups/nfl-picks-db-[timestamp].sqlite data/database.sqlite
docker-compose up -d

# Google Drive recovery
rclone copy gdrive:nfl-picks-backups/daily/[latest] data/database.sqlite
```

## Scoring System Business Logic

**Weekly scoring algorithm** (`backend/src/services/scoring.js`):
- **1 point per correct pick** - binary win/loss prediction
- **3 bonus points for perfect week** - all picks correct in single week
- **Monday Night Football prediction** - total combined score for tie-breaking
- **Scoring trigger**: Only runs when ALL games in week have `status = 'final'`

**Pick locking mechanism**: 
- Picks locked when `game.status != 'scheduled'`
- Enforced in frontend UI (disabled form controls) AND backend validation
- Lock status checked on every pick submission

**Tie-breaking logic**:
1. Total points (correct picks + perfect week bonuses)
2. Monday Night Football prediction accuracy (closest to actual total)
3. Most recent pick submission timestamp

## Database Schema Essentials

**Core entity relationships**:
```sql
users (id, username, email, is_admin, created_at)
  ↓ (one-to-many)
picks (user_id, game_id, selected_team_id, monday_night_prediction)
  ↓ (many-to-one)
games (id, week, season, home_team_id, visitor_team_id, status, date)
  ↓ (many-to-one for each team)
teams (id, name, city, abbreviation, conference, division)

weekly_scores (user_id, week, season, correct_picks, perfect_week_bonus, total_points)
```

**Critical performance indexes**:
- `games`: `(week, season)` for weekly queries
- `picks`: `(user_id, week, season)` for user scoring
- `weekly_scores`: `(week, season)` for leaderboards

**Live game data fields**:
- `live_status`: Real-time game status (e.g., "2nd Quarter", "Halftime")
- `quarter_time_remaining`: Clock display (e.g., "12:45")
- `home_team_score`, `visitor_team_score`: Live scoring updates

## Environment Configuration

**Development vs Production environments**:
```bash
# Development
NODE_ENV=development
DATABASE_PATH=./database.sqlite
PORT=3000
# seed.js runs, team logos fetch from TheSportsDB

# Production  
NODE_ENV=production
DATABASE_PATH=/app/data/database.sqlite
PORT=3001
# seed.js skipped, cached team logos served statically
```

**Required production environment variables**:
```bash
NODE_ENV=production
DATABASE_PATH=/app/data/database.sqlite
JWT_SECRET=[secure-random-string]
BALLDONTLIE_API_KEY=[api-key-from-balldontlie]
THESPORTSDB_API_KEY=[optional-for-team-logos]
NO_MOCK_DATA=true
```

**API service configuration**:
- **Ball Don't Lie API**: 5 requests/minute rate limit, NFL game data
- **TheSportsDB API**: 30 requests/minute rate limit, team logos  
- **ESPN CDN**: Fallback for team logos (no rate limits)

## Team Logo Management Patterns

**Static file serving**: Team logos cached as PNG files in `backend/public/team-logos/[team]_logo.png`

**Frontend logo requests**:
```typescript
getTeamLogo(abbreviation: string): string {
  return `${this.baseUrl}/team-logos/${abbreviation?.toLowerCase()}_logo.png`;
}
```

**Backend logo endpoint** (`/api/games/team-logo/:abbreviation`):
1. Check for cached file (7-day TTL)
2. Fetch from TheSportsDB API if needed
3. Download and cache image locally  
4. Fallback to ESPN CDN redirect

**Logo service error handling**:
```javascript
// Graceful fallback chain
try {
  return cachedFile;
} catch {
  try {
    return await fetchFromTheSportsDB();
  } catch {
    return redirectToESPN();
  }
}
```
