const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./config/db');

// Routes
const adminRoutes = require('./routes/adminRoutes');
const rmRoutes = require('./routes/rmRoutes')
const leadRoutes = require('./routes/rmRoutes')// ensure you have this file
const walletRoutes = require('./routes/walletRoutes');
const analyticRoutes = require('./routes/analytics');

const PORT = process.env.PORT || 5000;
const app = express();

// CORS Configuration
app.use(cors({
    origin: ["http://localhost:3000", "https://main.d3bswyde92xkjs.amplifyapp.com"],
    credentials: true
}));
// Middleware
app.use(express.json());
app.use(cookieParser());

// Static file routes
app.use('/uploads/aoma', express.static('uploads/aoma'));
app.use('/uploads/activation', express.static('uploads/activation'));
app.use('/uploads/ms_teams', express.static('uploads/ms_teams'));

// API Routes
app.use('/api/v1', adminRoutes);
app.use('/api/v1', rmRoutes);
app.use('/api/v1', leadRoutes);
app.use('/api/v1', walletRoutes);
app.use('/api/v1', analyticRoutes);

// Health Check
app.get("/", (req, res) => {
    return res.json({
        success: true,
        message: 'Your server is up and running...',
    });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
