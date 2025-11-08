const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up storage destination and file naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/aoma'; // default folder

    // Different upload folders based on request path
    if (/\/request-activation\/\d+/.test(req.path)) {
      folder = 'uploads/activation';
    } else if (/\/request-ms-teams-activation\/\d+/.test(req.path)) {
      folder = 'uploads/ms_teams';
    } 
    // ✅ New Client Call screenshot folder
    else if (/\/new-client-call-update/.test(req.path)) {
      folder = 'uploads/new_client_calls';
    } 
    // ✅ Basic MS Teams Screenshot folder (more accurate regex)
    else if (/\/basic_ms_teams-update/.test(req.path)) {
      folder = 'uploads/basic_ms_teams';
    }

    // Ensure folder exists
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Multer config with validation & limits
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only .jpeg, .png, and .pdf files are allowed!'));
    }
    cb(null, true);
  }
});

module.exports = upload;
