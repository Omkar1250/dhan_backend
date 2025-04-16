const jwt = require('jsonwebtoken');
require('dotenv').config();



exports.auth = (req, res, next) => {
  try {
    const token =
      req.cookies.token ||
      (req.header("Authorization") && req.header("Authorization").replace("Bearer ", ""));

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing"
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: "Token is invalid"
        });
      }

      // Store decoded token data on request object
      req.user = decoded;
      next();
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Something went wrong while validating the token",
      error: error.message
    });
  }
};

// Allow only admins
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Access denied: Admins only"
    });
  }
  next();
};

// Allow only RMs
exports.isRm = (req, res, next) => {
  if (req.user.role !== 'rm') {
    return res.status(403).json({
      success: false,
      message: "Access denied: RMs only"
    });
  }
  next();
};
