import mongoose from "mongoose";

const classRoomSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true, // e.g. "Class 10", "Grade 5"
      trim: true,
    },
    numericGrade: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

classRoomSchema.index({ schoolId: 1, name: 1 }, { unique: true });

const ClassRoom = mongoose.model("ClassRoom", classRoomSchema);
export default ClassRoom;
