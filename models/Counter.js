import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    entity: {
      type: String, // 'student', 'teacher', 'parent', 'receipt', 'certificate'
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

counterSchema.index({ schoolId: 1, entity: 1, year: 1 }, { unique: true });

const Counter = mongoose.model("Counter", counterSchema);
export default Counter;
