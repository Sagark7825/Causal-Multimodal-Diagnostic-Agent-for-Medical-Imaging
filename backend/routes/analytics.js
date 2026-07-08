const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const ClinicalCase = require('../models/ClinicalCase');
const RadiologyReport = require('../models/RadiologyReport');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET api/analytics/dashboard
// @desc    Get dashboard analytics (categorized by role queries)
router.get('/dashboard', protect, async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const totalCases = await ClinicalCase.countDocuments();
    const totalReports = await RadiologyReport.countDocuments();
    
    const totalDoctors = await User.countDocuments({ role: 'Doctor' });
    const totalRadiologists = await User.countDocuments({ role: 'Radiologist' });

    // Today's cases count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaysCases = await ClinicalCase.countDocuments({ createdAt: { $gte: startOfToday } });

    // Completed diagnoses cases count
    const completedCasesCount = await ClinicalCase.countDocuments({
      status: { $in: ['Treatment Completed', 'Case Closed'] }
    });

    // Pending Doctor Reviews queue
    const doctorPendingReviews = await ClinicalCase.find({ status: 'Doctor Review Pending' })
      .populate('patient')
      .populate('radiologyReport')
      .populate('aiPrediction')
      .sort({ updatedAt: -1 });

    // Radiologist Imaging Queue (Awaiting Scan or AI running)
    const radiologistQueue = await ClinicalCase.find({
      status: { $in: ['Awaiting Imaging', 'Imaging Uploaded', 'AI Analysis Completed'] }
    })
      .populate('patient')
      .sort({ createdAt: 1 });

    // Appointments (Doctor specific or global)
    let appointmentQuery = {};
    if (req.user.role === 'Doctor') {
      appointmentQuery.doctor = req.user._id;
    }
    const upcomingAppointments = await Appointment.find(appointmentQuery)
      .populate('patient')
      .populate('doctor', 'name role')
      .sort({ appointmentDate: 1 })
      .limit(10);

    // Recent Audit Logs for HIPAA monitoring
    const recentAudits = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(15);

    // AI & GPU Statistics
    const modelMetrics = {
      accuracy: 0.942,
      aiSuccessRate: 0.984,
      avgReportingTimeMin: 18,
      gpuLoadPct: 62.4,
      gpuTempC: 71,
      gpuMemoryUsageGb: 11.2,
      gpuMemoryLimitGb: 16.0,
      systemUptime: '14d 6h 12m',
      confusionMatrix: {
        tp: 142, fn: 8,
        fp: 9, tn: 161
      },
      mostCommonDiseases: [
        { name: 'Pneumonia', count: 48 },
        { name: 'Pituitary Adenoma', count: 32 },
        { name: 'Diabetic Retinopathy', count: 24 }
      ],
      datasetVersions: [
        { version: 'v2.4.1', date: '2026-06-01', size: '142 GB', description: 'Updated BraTS MRI segmentations' },
        { version: 'v2.3.0', date: '2026-03-15', size: '128 GB', description: 'MIMIC-CXR chest expansion weights' }
      ]
    };

    res.json({
      success: true,
      stats: {
        totalPatients,
        totalCases,
        totalReports,
        totalDoctors,
        totalRadiologists,
        todaysCases,
        completedCasesCount,
        approvalRate: totalCases > 0 ? Math.round((completedCasesCount / totalCases) * 100) : 0
      },
      doctorPendingReviews,
      radiologistQueue,
      upcomingAppointments,
      recentAudits,
      modelMetrics
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/analytics/audit-logs
// @desc    Get system audit logs (Admin only)
router.get('/audit-logs', protect, authorize('Admin'), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
