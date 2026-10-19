import mongoose from "mongoose";

const homeworkSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    assignedDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    attachmentUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Archived"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

homeworkSchema.index({ schoolId: 1, classId: 1, sectionId: 1, dueDate: -1 });

const Homework = mongoose.model("Homework", homeworkSchema);
export default Homework;
