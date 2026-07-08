const mongoose = require('mongoose');

const ClinicalCaseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  modality: {
    type: String,
    enum: ['Chest X-ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography', 'Dental X-ray', 'Others'],
    required: true
  },
  chiefComplaint: {
    type: String,
    required: true
  },
  clinicalNotes: {
    type: String,
    default: ''
  },
  reasonForImaging: {
    type: String,
    default: ''
  },
  priorityLevel: {
    type: String,
    enum: ['Routine', 'Urgent', 'Emergency'],
    required: true
  },
  status: {
    type: String,
    enum: [
      'New Case',
      'Awaiting Imaging',
      'Imaging Uploaded',
      'AI Analysis Completed',
      'Radiologist Review Completed',
      'Doctor Review Pending',
      'Treatment Completed',
      'Case Closed'
    ],
    default: 'Awaiting Imaging'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedRadiologist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  radiologyReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RadiologyReport'
  },
  aiPrediction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIPrediction'
  },
  treatmentPlan: {
    type: String,
    default: ''
  },
  prescription: {
    type: String,
    default: ''
  },
  followUpInstructions: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ClinicalCaseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ClinicalCase', ClinicalCaseSchema);
