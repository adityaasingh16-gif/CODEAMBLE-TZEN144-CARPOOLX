// Generates a 6-digit numeric OTP string, e.g. "042817"
const generateOTP = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

module.exports = { generateOTP };
