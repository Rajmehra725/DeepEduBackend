import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import FeePayment from "../models/FeePayment.js";

export const exportStudents = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId } = req.query;
    const query = { schoolId };
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;

    const students = await Student.find(query)
      .populate("classId", "name")
      .populate("sectionId", "name")
      .sort({ admissionNumber: 1 });

    const csvRows = [
      "AdmissionNumber,RollNumber,FirstName,LastName,Gender,Class,Section,ParentName,ParentPhone,Status",
    ];

    for (const s of students) {
      csvRows.push(
        `"${s.admissionNumber}","${s.rollNumber || ""}","${s.firstName}","${s.lastName || ""}","${s.gender}","${s.classId?.name || ""}","${s.sectionId?.name || ""}","${s.parentName}","${s.parentPhone}","${s.status}"`
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="students-${Date.now()}.csv"`
    );
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export students",
      error: error.message,
    });
  }
};

export const exportAttendance = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId, date } = req.query;
    const query = { schoolId };
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;
    if (date) query.date = date;

    const records = await Attendance.find(query)
      .populate("studentId", "admissionNumber firstName lastName")
      .populate("classId", "name")
      .populate("sectionId", "name")
      .sort({ date: -1 });

    const csvRows = [
      "Date,Session,AdmissionNumber,StudentName,Class,Section,Status,Remarks",
    ];

    for (const r of records) {
      csvRows.push(
        `"${r.date}","${r.session}","${r.studentId?.admissionNumber || ""}","${r.studentId?.firstName || ""} ${r.studentId?.lastName || ""}","${r.classId?.name || ""}","${r.sectionId?.name || ""}","${r.status}","${r.remarks || ""}"`
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${Date.now()}.csv"`
    );
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export attendance",
      error: error.message,
    });
  }
};

export const exportFees = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const payments = await FeePayment.find({ schoolId })
      .populate("studentId", "admissionNumber firstName lastName")
      .sort({ paymentDate: -1 });

    const csvRows = [
      "ReceiptNumber,Date,AdmissionNumber,StudentName,Amount,Method,Category,Remarks",
    ];

    for (const p of payments) {
      const dateStr = p.paymentDate
        ? new Date(p.paymentDate).toISOString().split("T")[0]
        : "";
      csvRows.push(
        `"${p.receiptNumber}","${dateStr}","${p.studentId?.admissionNumber || ""}","${p.studentId?.firstName || ""} ${p.studentId?.lastName || ""}","${p.amount}","${p.paymentMethod}","${p.feeCategory}","${p.remarks || ""}"`
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fee-collections-${Date.now()}.csv"`
    );
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export fees",
      error: error.message,
    });
  }
};
