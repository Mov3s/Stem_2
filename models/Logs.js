const mongoose = require('mongoose');

const LogsSchema = new mongoose.Schema({
  message: {
      type: String
  },
  level: {
      type: String
      //info, //warn, //error
  }, 
  exception: {
      type: String
  },
  date: {
      type: Date,
      default: Date.now
  }
});

LogsSchema.statics.addLog = async (level, message, exception) => {

    const newLog = new Logs(
        {
            level: level,
            message: message,
            exception: exception,
            date: Date.now()
        }
    )

    await newLog.save();
}

module.exports = Logs = mongoose.model('logs', LogsSchema);
