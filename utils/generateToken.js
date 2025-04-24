const jwt = require("jsonwebtoken");
require("dotenv").config();
exports.generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      personal_number: user.personal_number,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};
