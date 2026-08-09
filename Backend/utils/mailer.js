const nodemailer = require('nodemailer');

// Uses a Gmail App Password (not your normal Gmail password) — generate one
// at https://myaccount.google.com/apppasswords and put it in .env as
// EMAIL_PASSWORD.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

module.exports = transporter;
