const mongoose = require('mongoose');

const AIPredictionSchema = new mongoose.Schema({
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
  predictedDisease: {
    type: String,
    required: true
  },
  confidenceScore: {
    type: Number,
    required: true
  },
  affectedRegion: {
    type: String,
    default: ''
  },
  explainabilityHeatmap: {
    type: String,
    default: ''
  },
  severityLevel: {
    type: String,
    enum: ['Normal', 'Mild', 'Moderate', 'Severe', 'Critical'],
    default: 'Moderate'
  },
  suggestedFindings: {
    type: String,
    default: ''
  },
  suggestedObservation: {
    type: String,
    default: ''
  },
  differentialDiagnosis: {
    type: [String],
    default: []
  },
  boundingBoxes: [{
    label: String,
    xMin: Number,
    yMin: Number,
    xMax: Number,
    yMax: Number
  }],
  causalReasoning: {
    dagNodes: [String],
    dagEdges: [{ from: String, to: String, weight: Number }],
    backdoorAdjustedATE: mongoose.Schema.Types.Mixed,
    counterfactuals: mongoose.Schema.Types.Mixed
  },
  indicators: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AIPrediction', AIPredictionSchema);
