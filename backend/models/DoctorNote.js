const mongoose = require('mongoose');

const DoctorNoteSchema = new mongoose.Schema({
  clinicalCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClinicalCase',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  noteText: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DoctorNote', DoctorNoteSchema);
