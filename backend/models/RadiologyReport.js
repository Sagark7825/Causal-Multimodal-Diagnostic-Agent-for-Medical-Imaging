const mongoose = require('mongoose');

const RadiologyReportSchema = new mongoose.Schema({
  clinicalCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClinicalCase',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  scanUrl: {
    type: String,
    required: true
  },
  dicomMetadata: {
    type: Map,
    of: String,
    default: {}
  },
  radiologistObservation: {
    type: String,
    default: ''
  },
  aiPrediction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIPrediction'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Ready For Doctor Review'],
    default: 'Draft'
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

module.exports = mongoose.model('RadiologyReport', RadiologyReportSchema);
