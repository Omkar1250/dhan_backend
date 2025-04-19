const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const cookieParser = require('cookie-parser')
const adminRoutes= require('./routes/adminRoutes')
const rmRoutes = require('./routes/rmRoutes')
const leadRoutes = require('./routes/rmRoutes')
const PORT = process.env.PORT || 5000;
const app = express();
app.use(cors({
    origin: `http://localhost:${PORT}`,  // your React app domain
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
