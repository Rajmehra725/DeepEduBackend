import mongoose from "mongoose";

const classSubjectTeacherSchema = new mongoose.Schema(
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
    academicSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

classSubjectTeacherSchema.index(
  { schoolId: 1, classId: 1, sectionId: 1, subjectId: 1 },
  { unique: true }
);

const ClassSubjectTeacher = mongoose.model(
  "ClassSubjectTeacher",
  classSubjectTeacherSchema
);
export default ClassSubjectTeacher;
