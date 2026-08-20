const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const db = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS to allow frontend domains (Vercel, localhost, custom env)
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://splitfriendly.vercel.app'
];

const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);

    // Check exact match or any *.vercel.app domain
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }

    console.warn(`[CORS] Rejected request from origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Load Routes
const authRouter = require('./routes/auth');
const expensesRouter = require('./routes/expenses');
const squadsRouter = require('./routes/squads');
const usersRouter = require('./routes/users');

app.use('/api/auth', authRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/squads', squadsRouter);
app.use('/api/users', usersRouter);

// Health check endpoint
app.use('/api/health', (req, res) => {
  res.json({ status: 'active', timestamp: new Date() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Tactical subsystem error: ' + err.message });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`✓ SERVER RUNNING on http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
