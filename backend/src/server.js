const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// const rateLimit = require('express-rate-limit'); // Disabled - using API caching instead
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  console.error('Please check your .env file');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const pickRoutes = require('./routes/picks');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');

const { initializeDatabase } = require('./models/database');
const { scheduleDataFetch } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware with Angular-compatible CSP
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Lightweight request logger to capture origin and auth presence (helps debug CORS/auth issues)
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    const authHeader = !!req.headers['authorization'];
    console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.path} origin=${origin} auth=${authHeader}`);
  } catch (e) {
    // don't break requests on logging errors
  }
  next();
});
// CORS configuration - More permissive for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl requests)
    if (!origin) return callback(null, true);

    // Allow all localhost origins during development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Allow localhost on any port for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow specific frontend URL from environment
    if (origin === (process.env.FRONTEND_URL || 'http://localhost:4200')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Rate limiting completely disabled - using API caching instead
let rateLimit429Count = 0;
console.log('Rate limiting disabled - relying on comprehensive API caching');

// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000)),
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: (req, res) => {
//     rateLimit429Count++;
//     console.warn(`Rate limit exceeded for ${req.ip} path=${req.path} origin=${req.headers.origin || 'unknown'}`);
//     res.status(429).json({ message: 'Too many requests from this IP, please try again later.' });
//   }
// });

// Rate limiting disabled entirely
// if (process.env.NODE_ENV === 'development') {
//   console.log('Rate limiter disabled in development');
// } else {
//   app.use(limiter);
// }

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS headers specifically for static assets (team logos)
app.use(['/team-logos', '/api/team-logos'], (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Serve static files (team logos)
app.use('/team-logos', express.static(path.join(__dirname, '..', 'public', 'team-logos')));
// Also serve team logos under /api/team-logos/ for API consistency
app.use('/api/team-logos', express.static(path.join(__dirname, '..', 'public', 'team-logos')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/picks', pickRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), rateLimit429Count });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), rateLimit429Count });
});

// Serve Angular frontend in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the frontend dist folder
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    maxAge: '1d',
    etag: false,
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  // Catch all handler: send back Angular's index.html file for any non-API routes
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.url.startsWith('/api/') || req.url.startsWith('/health') || req.url.startsWith('/team-logos/')) {
      return res.status(404).json({ message: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler for API routes only (frontend routes handled above)
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    // On startup, ensure teams are populated and sync the current week's schedule
    const nflApiService = require('./services/nfl-api');
    try {
      console.log('Startup: fetching and storing teams...');
      await nflApiService.fetchAndStoreTeams();
      const { week, season } = nflApiService.getCurrentWeek();
      console.log(`Startup: syncing schedule for week ${week}, ${season}...`);
      await nflApiService.syncWeekSchedule(week, season);
      console.log('Startup schedule sync completed');
    } catch (startupErr) {
      console.error('Warning: startup data sync failed:', startupErr.message);
      // Continue starting the server; scheduler will attempt periodic refreshes
    }

    // Start the data fetch scheduler
    scheduleDataFetch();
    console.log('Data fetch scheduler started');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
