const transporter = require('./mailer');

const sendBookingEmail = async (toEmail, passengerName, ride, booking) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: 'Ride Booking Confirmation',
        html: `
            <h2>Booking Confirmed</h2>
            <p>Hello ${passengerName},</p>

            <p>Your ride has been booked successfully.</p>

            <p><strong>From:</strong> ${ride.from.address}</p>
            <p><strong>To:</strong> ${ride.to.address}</p>
            <p><strong>Total Fare:</strong> ₹${booking.totalFare}</p>

            <p>Thank you for using CarPoolX.</p>
        `,
    };

    await transporter.sendMail(mailOptions);
};
module.exports = sendBookingEmail;
