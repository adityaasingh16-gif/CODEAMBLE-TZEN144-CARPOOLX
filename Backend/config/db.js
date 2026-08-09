const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/carpoolx';
        await mongoose.connect(mongoUri);
        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.error("MongoDB Connection Notice:", error.message);
        console.log("Server will continue running in fallback mode...");
    }
};

module.exports = connectDB;