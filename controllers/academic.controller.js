import ClassRoom from "../models/ClassRoom.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import AcademicSession from "../models/AcademicSession.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";
import Student from "../models/Student.js";

export const getClasses = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const classes = await ClassRoom.find({ schoolId }).sort({ numericGrade: 1, name: 1 });

    const classIds = classes.map((c) => c._id);
    const sections = await Section.find({ schoolId, classId: { $in: classIds } })
      .populate("classTeacherId", "firstName lastName employeeId")
      .sort({ name: 1 });

    // Group sections by classId and fetch student counts
    const classesWithSections = await Promise.all(
      classes.map(async (cls) => {
        const clsSections = sections.filter(
          (s) => s.classId.toString() === cls._id.toString()
        );

        const sectionsWithCounts = await Promise.all(
          clsSections.map(async (sec) => {
            const studentCount = await Student.countDocuments({
              schoolId,
              classId: cls._id,
              sectionId: sec._id,
              status: "active",
            });
            return {
              ...sec.toObject(),
              studentCount,
            };
          })
        );

        const totalStudents = sectionsWithCounts.reduce(
          (sum, s) => sum + s.studentCount,
          0
        );

        return {
          ...cls.toObject(),
          sections: sectionsWithCounts,
          totalStudents,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: classesWithSections,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch classes",
      error: error.message,
    });
  }
};

export const createClass = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { name, numericGrade, sectionNames = ["A"] } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Class name is required (e.g. Class 10)",
      });
    }

    const existing = await ClassRoom.findOne({
      schoolId,
      name: name.trim(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Class '${name}' already exists in your school`,
      });
    }

    const newClass = await ClassRoom.create({
      schoolId,
      name: name.trim(),
      numericGrade: Number(numericGrade) || 0,
    });

    // Auto-create initial sections
    const createdSections = [];
    for (const secName of sectionNames) {
      const section = await Section.create({
        schoolId,
        classId: newClass._id,
        name: secName.trim().toUpperCase(),
      });
      createdSections.push(section);
    }

    return res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: {
        ...newClass.toObject(),
        sections: createdSections,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create class",
      error: error.message,
    });
  }
};

export const createSection = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId } = req.params;
    const { name, capacity = 45, classTeacherId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Section name is required (e.g. 'B')",
      });
    }

    const section = await Section.create({
      schoolId,
      classId,
      name: name.trim().toUpperCase(),
      capacity: Number(capacity) || 45,
      classTeacherId: classTeacherId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: section,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create section",
      error: error.message,
    });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const subjects = await Subject.find({ schoolId }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subjects",
      error: error.message,
    });
  }
};

export const createSubject = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { name, code, type = "Core" } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required",
      });
    }

    const subject = await Subject.create({
      schoolId,
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : "",
      type,
    });

    return res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: subject,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create subject",
      error: error.message,
    });
  }
};

export const getSessions = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const sessions = await AcademicSession.find({ schoolId }).sort({ startDate: -1 });

    return res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch academic sessions",
      error: error.message,
    });
  }
};

export const createSession = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { name, startDate, endDate, isCurrent = false } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Session name, start date, and end date are required",
      });
    }

    if (isCurrent) {
      await AcademicSession.updateMany({ schoolId }, { isCurrent: false });
    }

    const session = await AcademicSession.create({
      schoolId,
      name: name.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isCurrent: Boolean(isCurrent),
    });

    return res.status(201).json({
      success: true,
      message: "Academic session created successfully",
      data: session,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create academic session",
      error: error.message,
    });
  }
};

export const assignSubjectTeacher = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId, subjectId, teacherId, academicSessionId } = req.body;

    if (!classId || !sectionId || !subjectId || !teacherId) {
      return res.status(400).json({
        success: false,
        message: "classId, sectionId, subjectId, and teacherId are required",
      });
    }

    const assignment = await ClassSubjectTeacher.findOneAndUpdate(
      { schoolId, classId, sectionId, subjectId },
      {
        schoolId,
        classId,
        sectionId,
        subjectId,
        teacherId,
        academicSessionId: academicSessionId || null,
      },
      { upsert: true, new: true }
    )
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName employeeId");

    return res.status(200).json({
      success: true,
      message: "Teacher assigned to subject successfully",
      data: assignment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to assign teacher to subject",
      error: error.message,
    });
  }
};

export const getClassAssignments = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId } = req.query;
    const query = { schoolId };

    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;

    const assignments = await ClassSubjectTeacher.find(query)
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code type")
      .populate("teacherId", "firstName lastName employeeId email phone");

    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch class assignments",
      error: error.message,
    });
  }
};
