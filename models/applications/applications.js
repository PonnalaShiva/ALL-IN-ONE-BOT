
const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: 100 },
  text: { type: String, required: true, maxlength: 45 }, 
  placeholder: { type: String, maxlength: 100, default: '' }, 
  inputType: {
    type: String,
    enum: ['SHORT', 'PARAGRAPH'],
    default: 'PARAGRAPH'
  }, 
  required: { type: Boolean, default: true },
  minLength: { type: Number, default: 1, min: 0, max: 4000 },
  maxLength: { type: Number, default: 4000, min: 1, max: 4000 }
}, { _id: false });

const ApplicationSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  appName: { type: String, required: true, maxlength: 30 },
  questions: {
    type: [QuestionSchema],
    validate: {
      validator: function (v) {
        return v.length >= 0 && v.length <= 5; 
      },
      message: 'Applications can have between 0 and 5 questions (Discord modal limit)'
    },
    default: []
  },
  isActive: { type: Boolean, default: false },
  mainChannel: { type: String, default: null },
  responseChannel: { type: String, default: null }
});


ApplicationSchema.index({ guildId: 1, appName: 1 }, { unique: true });

const Application = mongoose.model('Application', ApplicationSchema);

module.exports = Application;
