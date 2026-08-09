const transporter = require('./mailer');

const sendSOSEmail = async (contact, user, ride, mapsLink) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: contact.email,
        subject: 'SOS Alert - CarPoolX',

        html: `
            <h2>Emergency Alert</h2>

            <p>${user.name} has triggered an SOS.</p>

            <p><strong>Ride:</strong></p>

            <p>${ride.from.address} → ${ride.to.address}</p>

            <p>
                <a href="${mapsLink}">
                    View Live Location
                </a>
            </p>
        `,
    };

    await transporter.sendMail(mailOptions);
};
module.exports = sendSOSEmail;
