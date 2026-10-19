import Exam from "../models/Exam.js";
import ExamMark from "../models/ExamMark.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import Attendance from "../models/Attendance.js";
import AcademicSession from "../models/AcademicSession.js";

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

export const getStudentMarksheetData = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId } = req.params;
    const { examId } = req.query;

    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("academicSessionId", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Role-based access validation for students and parents
    if (
      req.user.role === "student" &&
      student.userId &&
      student.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only access your own marksheet",
      });
    }

    if (
      req.user.role === "parent" &&
      student.parentUserId &&
      student.parentUserId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only access your linked child's marksheet",
      });
    }

    const school = await School.findById(schoolId);

    // Get exam
    let exam;
    if (examId) {
      exam = await Exam.findOne({ _id: examId, schoolId });
    } else {
      exam = await Exam.findOne({ schoolId }).sort({ startDate: -1 });
    }

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "No examination records found for this school",
      });
    }

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
        subjectId: m.subjectId?._id,
        subjectName: m.subjectId?.name || "Subject",
        subjectCode: m.subjectId?.code || "",
        subjectType: m.subjectId?.type || "Core",
        maxMarks: m.maxMarks,
        obtainedMarks: m.obtainedMarks,
        grade: m.grade,
        isAbsent: m.isAbsent,
        remarks: m.remarks,
      };
    });

    const percentage =
      totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(1)) : 0;
    const overallGrade = calculateGrade(totalObtained, totalMax);

    // Get attendance summary for this student
    const attendanceRecords = await Attendance.find({
      schoolId,
      studentId: student._id,
    });
    const totalWorkingDays = attendanceRecords.length;
    const daysPresent = attendanceRecords.filter((a) => a.status === "Present").length;
    const attendancePct =
      totalWorkingDays > 0
        ? Number(((daysPresent / totalWorkingDays) * 100).toFixed(1))
        : 100;

    return res.status(200).json({
      success: true,
      data: {
        school: {
          name: school.name,
          code: school.code,
          phone: school.phone,
          email: school.email,
          address: school.address,
          logo: school.logo,
        },
        student: {
          id: student._id,
          permanentId: student.permanentId || `STU-${student.admissionNumber}`,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber || "01",
          name: `${student.firstName} ${student.lastName || ""}`.trim(),
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          className: student.classId?.name || "Class 10",
          sectionName: student.sectionId?.name || "A",
          parentName: student.parentName,
          academicSession: student.academicSessionId?.name || "2026-2027",
        },
        exam: {
          id: exam._id,
          name: exam.name,
          term: exam.term,
          status: exam.status,
        },
        subjects: subjectScores,
        summary: {
          totalMax,
          totalObtained,
          percentage,
          overallGrade,
          result: hasFailed ? "FAIL" : "PASS",
          totalWorkingDays,
          daysPresent,
          attendancePct,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate marksheet data",
      error: error.message,
    });
  }
};

export const getPrintableMarksheetHTML = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId } = req.params;
    const { examId } = req.query;

    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("academicSessionId", "name");

    if (!student) {
      return res.status(404).send("<h3>Student not found</h3>");
    }

    if (
      req.user.role === "student" &&
      student.userId &&
      student.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).send("<h3>Unauthorized: You can only view your own marksheet</h3>");
    }

    if (
      req.user.role === "parent" &&
      student.parentUserId &&
      student.parentUserId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).send("<h3>Unauthorized: You can only view your child's marksheet</h3>");
    }

    const school = await School.findById(schoolId);
    let exam;
    if (examId) {
      exam = await Exam.findOne({ _id: examId, schoolId });
    } else {
      exam = await Exam.findOne({ schoolId }).sort({ startDate: -1 });
    }

    const marks = await ExamMark.find({
      schoolId,
      examId: exam?._id,
      studentId: student._id,
    }).populate("subjectId", "name code type");

    let totalMax = 0;
    let totalObtained = 0;
    let hasFailed = false;

    const rows = marks
      .map((m, idx) => {
        totalMax += m.maxMarks;
        totalObtained += m.obtainedMarks;
        if (m.grade === "F" || m.isAbsent) hasFailed = true;

        return `
        <tr>
          <td style="text-align:center; padding: 8px;">${idx + 1}</td>
          <td style="padding: 8px; font-weight: 600;">${m.subjectId?.name || "Subject"} (${m.subjectId?.code || ""})</td>
          <td style="text-align:center; padding: 8px;">${m.maxMarks}</td>
          <td style="text-align:center; padding: 8px; font-weight: 700;">${m.isAbsent ? "Absent" : m.obtainedMarks}</td>
          <td style="text-align:center; padding: 8px; font-weight: 700; color: #1E3A8A;">${m.grade}</td>
          <td style="padding: 8px; font-size: 11px;">${m.remarks || "Satisfactory"}</td>
        </tr>`;
      })
      .join("");

    const percentage =
      totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "0.0";
    const overallGrade = calculateGrade(totalObtained, totalMax);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Official Marksheet - ${student.firstName} ${student.lastName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; margin: 0; padding: 16px; background: #fff; }
    .sheet-border { border: 2px solid #1E3A8A; padding: 24px; border-radius: 8px; position: relative; }
    .inner-border { border: 1px solid #94A3B8; padding: 16px; border-radius: 4px; }
    .school-header { text-align: center; border-bottom: 2px solid #1E3A8A; padding-bottom: 12px; margin-bottom: 16px; }
    .school-name { font-size: 24px; font-weight: 800; color: #1E3A8A; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
    .school-address { font-size: 12px; color: #475569; margin-top: 4px; }
    .report-title { font-size: 16px; font-weight: 700; background: #EFF6FF; color: #1E3A8A; display: inline-block; padding: 6px 18px; border-radius: 20px; margin-top: 10px; border: 1px solid #BFDBFE; text-transform: uppercase; }
    .student-info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; line-height: 1.6; }
    .marks-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    .marks-table th, .marks-table td { border: 1px solid #CBD5E1; }
    .marks-table th { background: #F1F5F9; color: #1E3A8A; font-weight: 700; padding: 10px 8px; text-transform: uppercase; font-size: 11px; }
    .summary-box { display: flex; justify-content: space-between; margin-top: 16px; padding: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; }
    .summary-item { text-align: center; }
    .summary-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; }
    .summary-val { font-size: 16px; font-weight: 800; color: #0F172A; margin-top: 4px; }
    .signatures-row { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 20px; }
    .sig-block { text-align: center; width: 160px; }
    .sig-line { border-top: 1px solid #64748B; margin-bottom: 6px; }
    .sig-text { font-size: 12px; font-weight: 600; color: #334155; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="background: #1E3A8A; color: #fff; padding: 10px 20px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="sheet-border">
    <div class="inner-border">
      <div class="school-header">
        <h1 class="school-name">${school.name}</h1>
        <div class="school-address">${school.address?.street || ""}, ${school.address?.city || ""}, ${school.address?.state || ""} | Tel: ${school.phone || ""} | Email: ${school.email || ""}</div>
        <div class="report-title">Academic Progress Report — Session ${student.academicSessionId?.name || "2026-2027"}</div>
      </div>

      <div class="student-info-grid">
        <div>
          <div><strong>Student Name:</strong> ${student.firstName} ${student.lastName}</div>
          <div><strong>Permanent Student ID:</strong> ${student.permanentId || "STU-" + student.admissionNumber}</div>
          <div><strong>Admission No:</strong> ${student.admissionNumber}</div>
        </div>
        <div>
          <div><strong>Class & Section:</strong> ${student.classId?.name || ""} - ${student.sectionId?.name || ""}</div>
          <div><strong>Roll Number:</strong> ${student.rollNumber || "01"}</div>
          <div><strong>Examination:</strong> ${exam?.name || "Term Examination"}</div>
        </div>
        <div>
          <div><strong>Parent / Guardian:</strong> ${student.parentName}</div>
          <div><strong>Date of Birth:</strong> ${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "N/A"}</div>
          <div><strong>Result Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <table class="marks-table">
        <thead>
          <tr>
            <th style="width: 40px;">S.No</th>
            <th>Subject Name & Code</th>
            <th style="width: 90px;">Max Marks</th>
            <th style="width: 110px;">Marks Obtained</th>
            <th style="width: 80px;">Grade</th>
            <th>Performance Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-label">Grand Total</div>
          <div class="summary-val">${totalObtained} / ${totalMax}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Percentage</div>
          <div class="summary-val">${percentage}%</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Overall Grade</div>
          <div class="summary-val" style="color: #1E3A8A;">${overallGrade}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Result Status</div>
          <div class="summary-val" style="color: ${hasFailed ? "#DC2626" : "#059669"};">${hasFailed ? "FAILED" : "PASSED"}</div>
        </div>
      </div>

      <div class="signatures-row">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-text">Class Teacher</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-text">Parent / Guardian</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-text">Principal / Seal</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send("<h3>Failed to render marksheet</h3>");
  }
};
