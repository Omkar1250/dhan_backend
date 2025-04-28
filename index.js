const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const cookieParser = require('cookie-parser')
const adminRoutes= require('./routes/adminRoutes')
const rmRoutes = require('./routes/rmRoutes')
const leadRoutes = require('./routes/rmRoutes')
const walletRoutes = require('./routes/walletRoutes')
const AnalyticRoutes = require('./routes/analytics')
const PORT = process.env.PORT || 5000;
const app = express();
app.use(cors({
    origin: ["http://localhost:3000", "https://dashboardcyberking.netlify.app"] , // your React app domain
    credentials: true  
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads/aoma', express.static('uploads/aoma'));


// // Admin routes
app.use('/api/v1', adminRoutes);
app.use('/api/v1', adminRoutes);
app.use('/api/v1', rmRoutes);
app.use('/api/v1', leadRoutes);
app.use('/api/v1', walletRoutes)
app.use('/api/v1', AnalyticRoutes);

app.get("/", (req, res) => {
    return res.json({
        success: true,
        message: 'Your server is up and running...',
    });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
