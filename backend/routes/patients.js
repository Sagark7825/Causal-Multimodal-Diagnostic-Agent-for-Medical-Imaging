const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const ClinicalCase = require('../models/ClinicalCase');
const Appointment = require('../models/Appointment');
const DoctorNote = require('../models/DoctorNote');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// Helper to generate Patient ID (PAT-YYYY-XXXXXX)
const generatePatientId = async () => {
  const currentYear = new Date().getFullYear();
  const lastPatient = await Patient.findOne({ patientId: new RegExp(`^PAT-${currentYear}-`) }).sort({ createdAt: -1 });
  let nextNum = 1;
  if (lastPatient) {
    const parts = lastPatient.patientId.split('-');
    const numPart = parseInt(parts[2], 10);
    if (!isNaN(numPart)) {
      nextNum = numPart + 1;
    }
  }
  return `PAT-${currentYear}-${String(nextNum).padStart(6, '0')}`;
};

// Helper to generate Case ID (CASE-YYYY-XXXXXX)
const generateCaseId = async () => {
  const currentYear = new Date().getFullYear();
  const lastCase = await ClinicalCase.findOne({ caseId: new RegExp(`^CASE-${currentYear}-`) }).sort({ createdAt: -1 });
  let nextNum = 1;
  if (lastCase) {
    const parts = lastCase.caseId.split('-');
    const numPart = parseInt(parts[2], 10);
    if (!isNaN(numPart)) {
      nextNum = numPart + 1;
    }
  }
  return `CASE-${currentYear}-${String(nextNum).padStart(6, '0')}`;
};

// @route   GET api/patients
// @desc    Get all patients (filtered by default to active non-deleted patients)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.query.includeDeleted === 'true' ? {} : { isDeleted: { $ne: true } };
    const patients = await Patient.find(filter).sort({ name: 1 });
    res.json({ success: true, patients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/patients/search
// @desc    Search patients by name or patientId
router.get('/search', protect, async (req, res) => {
  const query = req.query.q || '';
  const includeDeleted = req.query.includeDeleted === 'true';
  try {
    const filterCondition = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { patientId: { $regex: query, $options: 'i' } }
      ]
    };
    if (!includeDeleted) {
      filterCondition.isDeleted = { $ne: true };
    }
    const patients = await Patient.find(filterCondition).limit(15);
    res.json({ success: true, patients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/patients/cases/all
// @desc    Get all clinical cases
router.get('/cases/all', protect, async (req, res) => {
  try {
    let query = {};
    // If Radiologist, they can only see cases assigned to them
    if (req.user.role === 'Radiologist') {
      query.status = { $ne: 'New Case' };
      query.assignedRadiologist = req.user._id;
    }
    const cases = await ClinicalCase.find(query)
      .populate('patient')
      .populate('createdBy', 'name role')
      .populate('assignedRadiologist', 'name role')
      .populate('radiologyReport')
      .populate('aiPrediction')
      .sort({ createdAt: -1 });
    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/patients/:id
// @desc    Get patient details & their history of cases
router.get('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const cases = await ClinicalCase.find({ patient: patient._id })
      .populate('radiologyReport')
      .populate('aiPrediction')
      .sort({ createdAt: -1 });

    const appointments = await Appointment.find({ patient: patient._id }).sort({ appointmentDate: 1 });

    // HIPAA Audit log
    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ_PATIENT_PHI',
      details: `Accessed medical records of patient: ${patient.name} (${patient.patientId})`,
      ipAddress: req.ip
    });

    res.json({ success: true, patient, cases, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/patients
// @desc    Register a new patient (Doctor only)
router.post('/', protect, authorize('Doctor'), async (req, res) => {
  const { name, age, gender, contactNumber, address, emergencyContact, medicalHistory, currentSymptoms, vitalSigns } = req.body;
  try {
    const patientId = await generatePatientId();
    const patient = await Patient.create({
      patientId,
      name,
      age,
      gender,
      contactNumber,
      address,
      emergencyContact,
      medicalHistory,
      currentSymptoms,
      vitalSigns
    });

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE_PATIENT',
      details: `Registered new patient: ${name} (${patientId})`,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, patient });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/patients/:id/cases
// @desc    Create a new Clinical Case for patient (Doctor only)
router.post('/:id/cases', protect, authorize('Doctor'), async (req, res) => {
  const { modality, chiefComplaint, clinicalNotes, reasonForImaging, priorityLevel, assignedRadiologist } = req.body;
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const caseId = await generateCaseId();
    const clinicalCase = await ClinicalCase.create({
      caseId,
      patient: patient._id,
      modality,
      chiefComplaint,
      clinicalNotes,
      reasonForImaging,
      priorityLevel,
      assignedRadiologist,
      status: 'Awaiting Imaging',
      createdBy: req.user._id
    });

    // Update patient's current symptoms and vitals in case they changed
    if (chiefComplaint) patient.currentSymptoms = chiefComplaint;
    await patient.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE_CLINICAL_CASE',
      details: `Created clinical case ${caseId} for patient ${patient.name} (${patient.patientId})`,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, clinicalCase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/patients/cases/:id
// @desc    Get details of a single Clinical Case
router.get('/cases/:id', protect, async (req, res) => {
  try {
    const clinicalCase = await ClinicalCase.findById(req.params.id)
      .populate('patient')
      .populate('createdBy', 'name role')
      .populate('assignedRadiologist', 'name role')
      .populate('radiologyReport')
      .populate('aiPrediction');

    if (!clinicalCase) {
      return res.status(404).json({ success: false, message: 'Clinical Case not found' });
    }

    // HIPAA Audit log
    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ_CLINICAL_CASE',
      details: `Accessed case details for Case ID: ${clinicalCase.caseId}`,
      ipAddress: req.ip
    });

    res.json({ success: true, clinicalCase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT api/patients/cases/:id
// @desc    Update Clinical Case status or diagnosis/prescription (Doctor only for final stages)
router.put('/cases/:id', protect, async (req, res) => {
  try {
    const clinicalCase = await ClinicalCase.findById(req.params.id);
    if (!clinicalCase) {
      return res.status(404).json({ success: false, message: 'Clinical Case not found' });
    }

    // Update fields
    const allowedUpdates = ['status', 'assignedRadiologist', 'treatmentPlan', 'prescription', 'followUpInstructions'];
    allowedUpdates.forEach(update => {
      if (req.body[update] !== undefined) {
        clinicalCase[update] = req.body[update];
      }
    });

    await clinicalCase.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_CLINICAL_CASE',
      details: `Updated case ${clinicalCase.caseId} (Status: ${clinicalCase.status})`,
      ipAddress: req.ip
    });

    res.json({ success: true, clinicalCase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/patients/cases/:id/notes
// @desc    Add a doctor note to case
router.post('/cases/:id/notes', protect, authorize('Doctor'), async (req, res) => {
  const { noteText } = req.body;
  try {
    const clinicalCase = await ClinicalCase.findById(req.params.id);
    if (!clinicalCase) {
      return res.status(404).json({ success: false, message: 'Clinical case not found' });
    }

    const note = await DoctorNote.create({
      clinicalCase: clinicalCase._id,
      doctor: req.user._id,
      noteText
    });

    res.status(201).json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/patients/cases/:id/notes
// @desc    Get doctor notes for a case
router.get('/cases/:id/notes', protect, async (req, res) => {
  try {
    const notes = await DoctorNote.find({ clinicalCase: req.params.id })
      .populate('doctor', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET api/patients/appointments
// @desc    Get appointments
router.get('/appointments/all', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Doctor') {
      query.doctor = req.user._id;
    }
    const appointments = await Appointment.find(query)
      .populate('patient')
      .populate('doctor', 'name role')
      .sort({ appointmentDate: 1 });
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/patients/appointments
// @desc    Create appointment
router.post('/appointments', protect, authorize('Doctor'), async (req, res) => {
  const { patientId, appointmentDate, reason } = req.body;
  try {
    const patientObj = await Patient.findById(patientId);
    if (!patientObj) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const appointment = await Appointment.create({
      patient: patientObj._id,
      doctor: req.user._id,
      appointmentDate,
      reason
    });

    res.status(201).json({ success: true, appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST api/patients/seed
// @desc    Clear all Patient / ClinicalCase / Appointment / DoctorNote collections (clean reset)
router.post('/seed', async (req, res) => {
  try {
    // Clear collections
    await Patient.deleteMany({});
    await ClinicalCase.deleteMany({});
    await Appointment.deleteMany({});
    await DoctorNote.deleteMany({});

    res.json({
      success: true,
      message: 'Cleared all Patient, ClinicalCase, and Appointment collections successfully',
      patients: [],
      cases: []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE api/patients/clear-all
// @desc    Delete all patient records from database
router.delete('/clear-all', protect, async (req, res) => {
  try {
    await Patient.deleteMany({});
    await ClinicalCase.deleteMany({});
    await Appointment.deleteMany({});
    await DoctorNote.deleteMany({});

    res.json({
      success: true,
      message: 'All dummy and existing patient records deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT api/patients/:id/temporary-delete
// @desc    Temporarily delete / archive a patient record (Doctor or Admin)
router.put('/:id/temporary-delete', protect, authorize('Doctor', 'Admin'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient record not found' });
    }

    patient.isDeleted = true;
    patient.deletedAt = new Date();
    await patient.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'TEMPORARILY_DELETE_PATIENT',
      details: `Temporarily deleted patient record: ${patient.name} (${patient.patientId})`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Patient ${patient.name} temporarily deleted successfully`, patient });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT api/patients/:id/restore
// @desc    Restore a temporarily deleted / archived patient record (Doctor or Admin)
router.put('/:id/restore', protect, authorize('Doctor', 'Admin'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient record not found' });
    }

    patient.isDeleted = false;
    patient.deletedAt = null;
    await patient.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'RESTORE_PATIENT',
      details: `Restored patient record: ${patient.name} (${patient.patientId})`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Patient ${patient.name} restored successfully`, patient });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
