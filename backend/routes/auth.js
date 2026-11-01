const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'medcausal_secret_key_12345', {
    expiresIn: '30d'
  });
};

// @route   POST api/auth/register
// @desc    Register a new user (default unapproved unless Admin)
router.post('/register', async (req, res) => {
  const { name, email, password, role, department, degreeCertificate } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Require degree certificate for Doctors
    if (role === 'Doctor' && !degreeCertificate) {
      return res.status(400).json({
        success: false,
        message: 'Degree completion certificate is required for Doctor registration.'
      });
    }

    // Admins are auto-approved, doctors/radiologists must be verified by Admin
    const isApproved = role === 'Admin';

    const user = await User.create({
      name,
      email,
      password,
      role,
      department,
      degreeCertificate: degreeCertificate || '',
      isApproved
    });
    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isApproved: user.isApproved, degreeCertificate: user.degreeCertificate }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user, verify approval status & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Restrict access if not approved by Admin
    if (!user.isApproved && user.role !== 'Admin') {
      const errorMsg = user.role === 'Doctor'
        ? 'Degree completion certificate pending verification by Admin. You cannot access the application until your degree certificate is verified.'
        : 'Your account is pending administrator verification. Access is currently restricted.';
      return res.status(403).json({
        success: false,
        message: errorMsg
      });
    }

    // Restrict access if user is suspended
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by the administrator.'
      });
    }

    // Write to audit log
    await AuditLog.create({
      user: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      details: 'User logged in successfully',
      ipAddress: req.ip
    });

    res.json({
      success: true,
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route   GET api/auth/users
// @desc    Retrieve all hospital users (Admin only)
router.get('/users', protect, authorize('Admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ role: 1, name: 1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/auth/pending-users
// @desc    Retrieve all clinicians awaiting approval (Admin only)
router.get('/pending-users', protect, authorize('Admin'), async (req, res) => {
  try {
    const pendings = await User.find({ isApproved: false }).select('-password');
    res.json({ success: true, users: pendings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/auth/approve-user/:id
// @desc    Approve a clinician account (Admin only)
router.post('/approve-user/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isApproved = true;
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'APPROVE_CLINICIAN',
      details: `Approved clinician account for ${user.name} (${user.email}) as ${user.role}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Approved access for ${user.name}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT api/auth/suspend/:id
// @desc    Suspend a user account (Admin only)
router.put('/suspend/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isSuspended = true;
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SUSPEND_USER',
      details: `Suspended user account for ${user.name} (${user.email})`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Suspended user ${user.name}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT api/auth/unsuspend/:id
// @desc    Unsuspend a user account (Admin only)
router.put('/unsuspend/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isSuspended = false;
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UNSUSPEND_USER',
      details: `Unsuspended user account for ${user.name} (${user.email})`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Unsuspended user ${user.name}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT api/auth/reset-password/:id
// @desc    Reset password of a user (Admin only)
router.put('/reset-password/:id', protect, authorize('Admin'), async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'New password is required' });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'RESET_PASSWORD',
      details: `Reset password for user ${user.name} (${user.email})`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Password reset successfully for ${user.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE api/auth/users/:id
// @desc    Delete a user account (Admin only)
router.delete('/users/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_USER',
      details: `Deleted user ${user.name} (${user.email})`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Deleted user ${user.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/auth/radiologists
// @desc    Retrieve all approved radiologists (Doctor only)
router.get('/radiologists', protect, async (req, res) => {
  try {
    const radiologists = await User.find({ role: 'Radiologist', isApproved: true }).select('name department');
    res.json({ success: true, radiologists });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/auth/seed
// @desc    Seed specific admin credentials and demo clinicians
router.post('/seed', async (req, res) => {
  try {
    await User.deleteMany({});
    
    // 1. Primary Admin
    const adminUser = await User.create({
      name: 'Sagar Khandagale',
      email: 'sagarkhandagale7825@gmail.com',
      password: 'sagar7825',
      role: 'Admin',
      isApproved: true,
      department: 'Administration'
    });

    // 2. Demo Admin
    await User.create({
      name: 'Dr. System Admin',
      email: 'admin@medcausal.com',
      password: 'password123',
      role: 'Admin',
      isApproved: true,
      department: 'Administration'
    });

    // 3. Demo Doctor
    const doctorUser = await User.create({
      name: 'Dr. Sarah Jenkins',
      email: 'doctor@medcausal.com',
      password: 'password123',
      role: 'Doctor',
      isApproved: true,
      department: 'Pulmonology'
    });

    // 4. Demo Radiologist
    const radUser = await User.create({
      name: 'Dr. Marcus Vance',
      email: 'radiologist@medcausal.com',
      password: 'password123',
      role: 'Radiologist',
      isApproved: true,
      department: 'Radiology'
    });

    // 5. Demo Receptionist
    await User.create({
      name: 'Elena Rostova',
      email: 'receptionist@medcausal.com',
      password: 'password123',
      role: 'Receptionist',
      isApproved: true,
      department: 'Front Desk'
    });

    // 6. Demo Lab Tech
    await User.create({
      name: 'David Chen',
      email: 'labtech@medcausal.com',
      password: 'password123',
      role: 'Lab Tech',
      isApproved: true,
      department: 'Pathology'
    });

    // 7. Demo Patient User
    await User.create({
      name: 'John Doe',
      email: 'patient@medcausal.com',
      password: 'password123',
      role: 'Patient',
      isApproved: true,
      department: 'Outpatient'
    });

    res.json({ 
      success: true, 
      message: 'Seeded system admin and demo clinician accounts successfully', 
      admin: { name: adminUser.name, email: adminUser.email, role: adminUser.role },
      doctor: { name: doctorUser.name, email: doctorUser.email },
      radiologist: { name: radUser.name, email: radUser.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
