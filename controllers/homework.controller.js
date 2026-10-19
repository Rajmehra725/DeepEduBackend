import Homework from "../models/Homework.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Notification from "../models/Notification.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";

export const getHomework = async (req, res) => {
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
    } else {
      const { classId, sectionId, subjectId } = req.query;
      if (classId) query.classId = classId;
      if (sectionId) query.sectionId = sectionId;
      if (subjectId) query.subjectId = subjectId;
    }

    const homeworkList = await Homework.find(query)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName employeeId")
      .sort({ dueDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: homeworkList,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch homework",
      error: error.message,
    });
  }
};

export const createHomework = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const {
      classId,
      sectionId,
      subjectId,
      title,
      description,
      dueDate,
      attachmentUrl = "",
    } = req.body;

    if (!classId || !sectionId || !subjectId || !title || !description || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "classId, sectionId, subjectId, title, description, and dueDate are required",
      });
    }

    let teacher = null;
    if (req.user.role === "teacher") {
      teacher = await Teacher.findOne({ userId, schoolId });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "No teacher profile linked to your user account",
        });
      }

      // Check if teacher is assigned to this class and subject
      const isAssigned = await ClassSubjectTeacher.findOne({
        schoolId,
        classId,
        sectionId,
        subjectId,
        teacherId: teacher._id,
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not assigned to teach this subject to this class section",
        });
      }
    } else if (req.user.role === "principal") {
      // Principal can specify or assign a teacher, or use first teacher
      teacher = await Teacher.findOne({ schoolId });
    }

    const homework = await Homework.create({
      schoolId,
      classId,
      sectionId,
      subjectId,
      teacherId: teacher?._id,
      title: title.trim(),
      description: description.trim(),
      dueDate: new Date(dueDate),
      attachmentUrl,
      status: "Active",
    });

    const populatedHomework = await Homework.findById(homework._id)
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName");

    // Send notifications to students in that class section
    const students = await Student.find({
      schoolId,
      classId,
      sectionId,
      status: "active",
    });

    for (const st of students) {
      await Notification.create({
        schoolId,
        recipientId: st.userId,
        title: `New Homework: ${title}`,
        message: `Due date: ${new Date(dueDate).toLocaleDateString()}. Check description.`,
        type: "Homework",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Homework assigned successfully",
      data: populatedHomework,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create homework",
      error: error.message,
    });
  }
};

export const deleteHomework = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const query = { _id: id, schoolId };
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ userId: req.user._id, schoolId });
      query.teacherId = teacher?._id;
    }

    const deleted = await Homework.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Homework not found or you are not authorized to delete it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Homework deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete homework",
      error: error.message,
    });
  }
};
