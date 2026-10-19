import Exam from "../models/Exam.js";
import ExamMark from "../models/ExamMark.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Notification from "../models/Notification.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";

const calculateGrade = (obtained, max) => {
  if (max <= 0) return "F";
  const pct = (obtained / max) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 40) return "D";
  return "F";
};

export const getExams = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const exams = await Exam.find({ schoolId })
      .populate("academicSessionId", "name")
      .sort({ startDate: -1 });

    return res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch exams",
      error: error.message,
    });
  }
};

export const createExam = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { name, term, academicSessionId, startDate, endDate } = req.body;

    if (!name || !academicSessionId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "name, academicSessionId, startDate, and endDate are required",
      });
    }

    const exam = await Exam.create({
      schoolId,
      name: name.trim(),
      term: term || "Term 1",
      academicSessionId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "Scheduled",
    });

    return res.status(201).json({
      success: true,
      message: "Exam scheduled successfully",
      data: exam,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create exam",
      error: error.message,
    });
  }
};

export const getMarks = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { examId } = req.params;
    const { classId, sectionId, subjectId } = req.query;

    if (!classId || !sectionId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: "classId, sectionId, and subjectId are required",
      });
    }

    const exam = await Exam.findOne({ _id: examId, schoolId });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found in your school",
      });
    }

    const students = await Student.find({
      schoolId,
      classId,
      sectionId,
      status: "active",
    }).sort({ rollNumber: 1, firstName: 1 });

    const existingMarks = await ExamMark.find({
      schoolId,
      examId,
      classId,
      sectionId,
      subjectId,
    });

    const marksMap = {};
    existingMarks.forEach((m) => {
      marksMap[m.studentId.toString()] = m;
    });

    const marksSheet = students.map((s) => ({
      studentId: s._id,
      admissionNumber: s.admissionNumber,
      rollNumber: s.rollNumber,
      name: `${s.firstName} ${s.lastName || ""}`.trim(),
      maxMarks: marksMap[s._id.toString()]?.maxMarks || 100,
      obtainedMarks: marksMap[s._id.toString()]?.obtainedMarks || 0,
      grade: marksMap[s._id.toString()]?.grade || "F",
      isAbsent: marksMap[s._id.toString()]?.isAbsent || false,
      remarks: marksMap[s._id.toString()]?.remarks || "",
      isSaved: Boolean(marksMap[s._id.toString()]),
    }));

    return res.status(200).json({
      success: true,
      data: {
        exam,
        marksSheet,
        isLocked: exam.status === "Published" || exam.status === "Locked",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch marks sheet",
      error: error.message,
    });
  }
};

export const saveMarks = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { examId } = req.params;
    const { classId, sectionId, subjectId, marks = [] } = req.body;

    const exam = await Exam.findOne({ _id: examId, schoolId });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    if (exam.status === "Published" || exam.status === "Locked") {
      return res.status(400).json({
        success: false,
        message: "Marks cannot be modified because results have already been published and locked",
      });
    }

    // If teacher, verify assigned to this class and subject
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ userId, schoolId });
      const isAssigned = await ClassSubjectTeacher.findOne({
        schoolId,
        classId,
        sectionId,
        subjectId,
        teacherId: teacher?._id,
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not assigned to grade this subject for this class",
        });
      }
    }

    const savedRecords = [];
    for (const item of marks) {
      const {
        studentId,
        maxMarks = 100,
        obtainedMarks = 0,
        isAbsent = false,
        remarks = "",
      } = item;

      if (obtainedMarks > maxMarks) {
        return res.status(400).json({
          success: false,
          message: `Obtained marks (${obtainedMarks}) cannot exceed maximum marks (${maxMarks}) for student ${studentId}`,
        });
      }

      const grade = isAbsent ? "Ab" : calculateGrade(obtainedMarks, maxMarks);

      const record = await ExamMark.findOneAndUpdate(
        { schoolId, examId, subjectId, studentId },
        {
          schoolId,
          examId,
          classId,
          sectionId,
          subjectId,
          studentId,
          maxMarks: Number(maxMarks),
          obtainedMarks: isAbsent ? 0 : Number(obtainedMarks),
          grade,
          isAbsent: Boolean(isAbsent),
          enteredBy: userId,
          remarks,
        },
        { upsert: true, new: true }
      );
      savedRecords.push(record);
    }

    return res.status(200).json({
      success: true,
      message: `Marks saved successfully for ${savedRecords.length} students`,
      data: savedRecords,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to save marks",
      error: error.message,
    });
  }
};

export const publishExam = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { examId } = req.params;

    const exam = await Exam.findOneAndUpdate(
      { _id: examId, schoolId },
      { status: "Published" },
      { new: true }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    // Broadcast notification to all students and parents
    const students = await Student.find({ schoolId, status: "active" });
    for (const st of students) {
      await Notification.create({
        schoolId,
        recipientId: st.userId,
        title: `Results Published: ${exam.name}`,
        message: `Examination results for ${exam.name} have been published. Check your report card now.`,
        type: "Exam",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam results published and locked successfully",
      data: exam,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to publish exam",
      error: error.message,
    });
  }
};

export const getStudentReportCard = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, examId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required",
      });
    }

    // Role check: verify student/parent only accesses authorized student
    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id, schoolId });
      if (!student || student._id.toString() !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You may only view your own report card",
        });
      }
    }

    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in your school",
      });
    }

    const examQuery = { schoolId, status: "Published" };
    if (examId) examQuery._id = examId;

    const publishedExams = await Exam.find(examQuery).sort({ startDate: -1 });

    const reportCards = await Promise.all(
      publishedExams.map(async (exam) => {
        const marks = await ExamMark.find({
          schoolId,
          examId: exam._id,
          studentId: student._id,
        }).populate("subjectId", "name code type");

        let totalMax = 0;
        let totalObtained = 0;
        let hasFailed = false;

        const subjectScores = marks.map((m) => {
          totalMax += m.maxMarks;
          totalObtained += m.obtainedMarks;
          if (m.grade === "F" || m.isAbsent) hasFailed = true;

          return {
            subjectName: m.subjectId?.name || "Subject",
            subjectCode: m.subjectId?.code || "",
            maxMarks: m.maxMarks,
            obtainedMarks: m.obtainedMarks,
            grade: m.grade,
            isAbsent: m.isAbsent,
            remarks: m.remarks,
          };
        });

        const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "0.0";
        const overallGrade = calculateGrade(totalObtained, totalMax);

        return {
          exam: {
            id: exam._id,
            name: exam.name,
            term: exam.term,
          },
          subjects: subjectScores,
          totalMax,
          totalObtained,
          percentage: Number(percentage),
          overallGrade,
          result: hasFailed ? "FAIL" : "PASS",
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        student,
        reportCards,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student report card",
      error: error.message,
    });
  }
};
