import TimetableSlot from "../models/TimetableSlot.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import ClassRoom from "../models/ClassRoom.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";

export const getTimetable = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const query = { schoolId };

    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id, schoolId });
      if (student) {
        query.classId = student.classId;
        query.sectionId = student.sectionId;
      }
    } else if (req.user.role === "parent") {
      const { studentId } = req.query;
      if (studentId) {
        const student = await Student.findOne({ _id: studentId, schoolId });
        if (student) {
          query.classId = student.classId;
          query.sectionId = student.sectionId;
        }
      }
    } else if (req.user.role === "teacher" && req.query.view === "my") {
      const teacher = await Teacher.findOne({ userId: req.user._id, schoolId });
      if (teacher) {
        query.teacherId = teacher._id;
      }
    } else {
      const { classId, sectionId, dayOfWeek } = req.query;
      if (classId) query.classId = classId;
      if (sectionId) query.sectionId = sectionId;
      if (dayOfWeek) query.dayOfWeek = dayOfWeek;
    }

    const slots = await TimetableSlot.find(query)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("subjectId", "name code type")
      .populate("teacherId", "firstName lastName employeeId")
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    return res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch timetable",
      error: error.message,
    });
  }
};

export const addSlot = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const {
      classId,
      sectionId,
      dayOfWeek,
      periodNumber,
      startTime = "09:00",
      endTime = "09:45",
      subjectId,
      teacherId,
      roomNumber = "Room 101",
    } = req.body;

    if (!classId || !sectionId || !dayOfWeek || !periodNumber || !subjectId || !teacherId) {
      return res.status(400).json({
        success: false,
        message: "classId, sectionId, dayOfWeek, periodNumber, subjectId, and teacherId are required",
      });
    }

    // 1. Conflict Check: Is Teacher already booked in another class in the same day and period?
    const teacherConflict = await TimetableSlot.findOne({
      schoolId,
      teacherId,
      dayOfWeek,
      periodNumber: Number(periodNumber),
    })
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("teacherId", "firstName lastName");

    if (
      teacherConflict &&
      (teacherConflict.classId._id.toString() !== classId.toString() ||
        teacherConflict.sectionId._id.toString() !== sectionId.toString())
    ) {
      const tName = teacherConflict.teacherId
        ? `${teacherConflict.teacherId.firstName} ${teacherConflict.teacherId.lastName}`
        : "Teacher";
      return res.status(409).json({
        success: false,
        message: `Teacher Conflict: ${tName} is already assigned to ${teacherConflict.classId?.name || "Class"}-${teacherConflict.sectionId?.name || "Section"} during Period ${periodNumber} on ${dayOfWeek}.`,
      });
    }

    // 2. Conflict Check: Is Room already booked in the same day and period?
    if (roomNumber) {
      const roomConflict = await TimetableSlot.findOne({
        schoolId,
        roomNumber: roomNumber.trim(),
        dayOfWeek,
        periodNumber: Number(periodNumber),
      })
        .populate("classId", "name")
        .populate("sectionId", "name");

      if (
        roomConflict &&
        (roomConflict.classId?._id?.toString() !== classId.toString() ||
          roomConflict.sectionId?._id?.toString() !== sectionId.toString())
      ) {
        return res.status(409).json({
          success: false,
          message: `Room Conflict: ${roomNumber} is already in use by ${roomConflict.classId?.name || "Class"}-${roomConflict.sectionId?.name || "Section"} during Period ${periodNumber} on ${dayOfWeek}.`,
        });
      }
    }

    // Upsert timetable slot for this class-section-day-period
    const slot = await TimetableSlot.findOneAndUpdate(
      {
        schoolId,
        classId,
        sectionId,
        dayOfWeek,
        periodNumber: Number(periodNumber),
      },
      {
        schoolId,
        classId,
        sectionId,
        dayOfWeek,
        periodNumber: Number(periodNumber),
        startTime,
        endTime,
        subjectId,
        teacherId,
        roomNumber: roomNumber.trim(),
      },
      { upsert: true, new: true }
    )
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName employeeId");

    return res.status(200).json({
      success: true,
      message: `Timetable slot scheduled successfully (Period ${periodNumber}, ${dayOfWeek})`,
      data: slot,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to schedule timetable slot",
      error: error.message,
    });
  }
};

export const deleteSlot = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const deleted = await TimetableSlot.findOneAndDelete({ _id: id, schoolId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Timetable slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Timetable slot deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete slot",
      error: error.message,
    });
  }
};
