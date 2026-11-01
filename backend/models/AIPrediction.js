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
  heatmapBase64: {
    type: String,
    default: ''
  },
  severityLevel: {
    type: String,
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

  // Full LLM Clinical Reasoning & Differential Diagnosis
  reasoningNarrative: {
    type: String,
    default: ''
  },
  differentialDiagnosis: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  positiveFindings: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  rawProbabilities: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  uncertaintyAnalysis: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  limitations: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  llmModelUsed: {
    type: String,
    default: ''
  },
  reasoningSource: {
    type: String,
    default: ''
  },

  // LLM Treatment Recommendations
  treatmentRecommendations: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  drugRecommendations: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  followUpRecommendations: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  investigations: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },

  // Visual & Causal DAG
  boundingBoxes: [{
    label: String,
    xMin: Number,
    yMin: Number,
    xMax: Number,
    yMax: Number
  }],
  causalReasoning: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  indicators: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { strict: false });

module.exports = mongoose.model('AIPrediction', AIPredictionSchema);
