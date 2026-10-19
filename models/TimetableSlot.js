import mongoose from "mongoose";

const timetableSlotSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      required: true,
    },
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    startTime: {
      type: String, // e.g. "09:00"
      default: "09:00",
    },
    endTime: {
      type: String, // e.g. "09:45"
      default: "09:45",
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    roomNumber: {
      type: String,
      default: "Room 101",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// One class-section can only have one period at that slot
timetableSlotSchema.index(
  { schoolId: 1, classId: 1, sectionId: 1, dayOfWeek: 1, periodNumber: 1 },
  { unique: true }
);

// Indexes to speed up conflict lookups
timetableSlotSchema.index({
  schoolId: 1,
  teacherId: 1,
  dayOfWeek: 1,
  periodNumber: 1,
});

timetableSlotSchema.index({
  schoolId: 1,
  roomNumber: 1,
  dayOfWeek: 1,
  periodNumber: 1,
});

const TimetableSlot = mongoose.model("TimetableSlot", timetableSlotSchema);
export default TimetableSlot;
