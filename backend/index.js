const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const db = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS to allow our React app's port
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

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
