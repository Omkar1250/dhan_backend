const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const path = require('path');
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
    origin: ["http://localhost:3000",  "https://dhan.cyberkingcapitals.com","https://www.dhan.cyberkingcapitals.com"],
    credentials: true
}));
// ✅ Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ Serve static uploads (all folders)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// OR (optional, more explicit routes)
app.use('/uploads/aoma', express.static(path.join(__dirname, 'uploads/aoma')));
app.use('/uploads/activation', express.static(path.join(__dirname, 'uploads/activation')));
app.use('/uploads/ms_teams', express.static(path.join(__dirname, 'uploads/ms_teams')));
app.use('/uploads/new_client_calls', express.static(path.join(__dirname, 'uploads/new_client_calls')));
app.use('/uploads/basic_ms_teams', express.static(path.join(__dirname, 'uploads/basic_ms_teams')));


console.log("✅ Serving uploads from:", path.join(__dirname, "uploads"));

// ✅ API Routes
app.use('/api/v1', adminRoutes);
app.use('/api/v1', rmRoutes);
app.use('/api/v1', leadRoutes);
app.use('/api/v1', walletRoutes);
app.use('/api/v1', analyticRoutes);

// ✅ Health Check
app.get("/", (req, res) => {
    return res.json({
        success: true,
        message: '🚀 Server is up and running...',
    });
});

// ✅ Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
