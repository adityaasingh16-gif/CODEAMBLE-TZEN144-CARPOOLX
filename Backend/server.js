const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Ride = require('./models/Ride');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Standard Middlewares
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim())
  : '*';

app.use(cors()); // Allow all cross-origin requests cleanly in dev/prod
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP Server instance
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.replace(/^Bearer /, '');
    if (!token || !process.env.JWT_SECRET) return next(new Error('Authentication required.'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.accountStatus !== 'active') return next(new Error('Invalid account.'));
    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error('Invalid socket token.'));
  }
});

// Attach Socket.io instance to Express app object so controllers can emit real-time events
app.set('socketio', io);

// Socket.io Real-time Event Handlers
io.on('connection', (socket) => {
  socket.on('join_ride', async ({ rideId }) => {
    const ride = await Ride.findById(rideId).select('driver passengers.user');
    if (!ride) return socket.emit('socket_error', { message: 'Ride not found.' });
    const isMember = ride.driver.toString() === socket.user._id.toString() ||
      ride.passengers.some((passenger) => passenger.user.toString() === socket.user._id.toString());
    if (!isMember) return socket.emit('socket_error', { message: 'Ride membership required.' });
    socket.join(rideId);
  });

  socket.on('leave_ride', ({ rideId }) => {
    socket.leave(rideId);
  });

  socket.on('update_location', async ({ rideId, latitude, longitude, heading, speed }) => {
    const ride = await Ride.findOne({ _id: rideId, driver: socket.user._id, status: 'in-progress' }).select('_id');
    if (!ride || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return socket.emit('socket_error', { message: 'Only the active driver can update ride location.' });
    }
    socket.to(rideId).emit('driver_location_updated', {
      latitude,
      longitude,
      heading,
      speed,
      timestamp: new Date(),
    });
  });

  socket.on('send_sos_alert', async ({ rideId, location, reason }) => {
    const ride = await Ride.findById(rideId).select('driver passengers.user');
    if (!ride) return socket.emit('socket_error', { message: 'Ride not found.' });
    const isMember = ride.driver.toString() === socket.user._id.toString() ||
      ride.passengers.some((passenger) => passenger.user.toString() === socket.user._id.toString());
    if (!isMember) return socket.emit('socket_error', { message: 'Ride membership required.' });
    io.to(rideId).emit('sos_triggered', {
      alertBy: socket.user._id,
      location,
      reason,
      timestamp: new Date(),
    });
  });

});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rides', require('./routes/rideRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/sos', require('./routes/sosRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Ride-Sharing Backend Engine is Running' });
});

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Start Server
const parsedPort = parseInt(process.env.PORT, 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5001;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
