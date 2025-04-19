const multer = require('multer');
const path = require('path');

// Set up storage destination and file naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/aoma';  // default folder

    if (req.url.includes('/request-activation/:leadId')) {
      folder = 'uploads/activation';
    } else if (req.url.includes('/request-ms-teams-login/:leadId')) {
      folder = 'uploads/ms_teams';
    }

    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

module.exports = upload;
