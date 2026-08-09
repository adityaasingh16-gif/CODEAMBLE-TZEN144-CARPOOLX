const User = require('../models/User');
const OTP = require('../models/OTP');
const generateToken = require('../utils/generateToken'); // Utility to sign JWT
const { generateOTP } = require('../utils/generateOTP');
const { sendSMS } = require('../utils/sendNotification');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

/**
 * @desc    Register a new user (Driver or Passenger)
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, password, gender, isDriver, vehicleDetails } = req.body;
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    if (!name?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      !/^\d{10,15}$/.test(phone) || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Name, valid email, valid phone, and a password of at least 8 characters are required.' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email or phone number.' });
    }

    // Driver validation check
    if (isDriver && !vehicleDetails) {
      return res.status(400).json({ message: 'Vehicle details are required for driver accounts.' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      gender,
      isDriver: isDriver || false,
      vehicleDetails: isDriver ? vehicleDetails : undefined,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isDriver: user.isDriver,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data provided.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isDriver: user.isDriver,
        isVerified: user.isVerified,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user profile (Includes safety & passenger details for algorithm matching)
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update profile & safety settings (Emergency Contacts, Nearest Police Station)
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.phone = req.body.phone || user.phone;
      user.gender = req.body.gender || user.gender;

      // Update safety features (Rule 7 & 8)
      if (req.body.emergencyContacts) {
        user.emergencyContacts = req.body.emergencyContacts;
      }
      if (req.body.nearestPoliceStation) {
        user.nearestPoliceStation = req.body.nearestPoliceStation;
      }
      if (typeof req.body.emergencySOS === 'boolean') {
        user.emergencySOS = req.body.emergencySOS;
      }

      // Update Driver details if applicable
      if (user.isDriver && req.body.vehicleDetails) {
        user.vehicleDetails = { ...user.vehicleDetails, ...req.body.vehicleDetails };
      }
      if (user.isDriver && req.body.drivingLicense) {
        user.drivingLicense = { ...user.drivingLicense, ...req.body.drivingLicense };
      }
      // Any change to vehicle/license info invalidates a previous approval -
      // an admin needs to look at the new details, not the old ones.
      if (user.isDriver && (req.body.vehicleDetails || req.body.drivingLicense)) {
        user.drivingLicenseVerified = false;
        user.verificationStatus = 'pending';
        user.verificationNote = '';
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        gender: updatedUser.gender,
        isDriver: updatedUser.isDriver,
        vehicleDetails: updatedUser.vehicleDetails,
        drivingLicense: updatedUser.drivingLicense,
        verificationStatus: updatedUser.verificationStatus,
        verificationNote: updatedUser.verificationNote,
        emergencyContacts: updatedUser.emergencyContacts,
        nearestPoliceStation: updatedUser.nearestPoliceStation,
        emergencySOS: updatedUser.emergencySOS,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send OTP for phone verification
 * @route   POST /api/auth/send-otp
 * @access  Private
 */
const sendOTP = async (req, res, next) => {
  try {
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await OTP.create({
      userId: req.user._id,
      otp: otpCode,
      expiresAt,
    });

    // Dispatch SMS via utility
    await sendSMS(req.user.phone, `Your ride-sharing verification OTP is: ${otpCode}`);

    res.json({ message: 'OTP sent successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/auth/verify-otp
 * @access  Private
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;

    const validOTP = await OTP.findOne({
      userId: req.user._id,
      otp,
      expiresAt: { $gt: Date.now() },
    });

    if (!validOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // Mark user as verified
    await User.findByIdAndUpdate(req.user._id, { isVerified: true });
    await OTP.deleteMany({ userId: req.user._id }); // Clear used OTPs

    res.json({ message: 'Phone number verified successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List drivers whose documents need review (admin only)
 * @route   GET /api/auth/admin/drivers?status=pending
 * @access  Private/Admin
 */
const listDriversForReview = async (req, res, next) => {
  try {
    const status = req.query.status; // 'pending' | 'approved' | 'rejected' | omitted = all drivers
    const filter = { isDriver: true };
    if (status) filter.verificationStatus = status;

    const drivers = await User.find(filter).select(
      'name email phone vehicleDetails drivingLicense drivingLicenseVerified verificationStatus verificationNote createdAt'
    );
    res.json(drivers);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve or reject a driver's vehicle/license details (admin only)
 * @route   PUT /api/auth/admin/drivers/:id/review
 * @access  Private/Admin
 * @body    { approve: boolean, note?: string }
 */
const reviewDriver = async (req, res, next) => {
  try {
    const { approve, note } = req.body;
    const driver = await User.findById(req.params.id);

    if (!driver || !driver.isDriver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    if (approve) {
      driver.drivingLicenseVerified = true;
      driver.verificationStatus = 'approved';
      driver.verificationNote = '';
    } else {
      driver.drivingLicenseVerified = false;
      driver.verificationStatus = 'rejected';
      driver.verificationNote = note || 'Documents did not pass review.';
    }

    await driver.save();
    res.json({
      message: `Driver ${approve ? 'approved' : 'rejected'}.`,
      verificationStatus: driver.verificationStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List/search all users - passengers and drivers (admin only)
 * @route   GET /api/auth/admin/users?search=&role=driver|passenger|all
 * @access  Private/Admin
 */
const listAllUsers = async (req, res, next) => {
  try {
    const { search, role } = req.query;
    const filter = {};

    if (role === 'driver') filter.isDriver = true;
    if (role === 'passenger') filter.isDriver = false;

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const users = await User.find(filter).select('-password').sort('-createdAt');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Activate/suspend/block any user account (admin only)
 * @route   PUT /api/auth/admin/users/:id/status
 * @access  Private/Admin
 * @body    { status: 'active' | 'suspended' | 'blocked' }
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'blocked'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active, suspended, or blocked.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.accountStatus = status;
    await user.save();

    res.json({ message: `Account set to ${status}.`, accountStatus: user.accountStatus });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  sendOTP,
  verifyOTP,
  listDriversForReview,
  reviewDriver,
  listAllUsers,
  updateUserStatus,
};