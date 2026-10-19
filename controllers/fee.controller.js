import FeeStructure from "../models/FeeStructure.js";
import FeePayment from "../models/FeePayment.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import Notification from "../models/Notification.js";

export const getStructures = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId } = req.query;
    const query = { schoolId };
    if (classId) query.classId = classId;

    const structures = await FeeStructure.find(query)
      .populate("classId", "name numericGrade")
      .sort({ classId: 1, category: 1 });

    return res.status(200).json({
      success: true,
      data: structures,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch fee structures",
      error: error.message,
    });
  }
};

export const createStructure = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, category, amount, frequency = "Quarterly", dueDate } = req.body;

    if (!classId || !category || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "classId, category, and amount are required",
      });
    }

    const structure = await FeeStructure.findOneAndUpdate(
      { schoolId, classId, category },
      {
        schoolId,
        classId,
        category: category.trim(),
        amount: Number(amount),
        frequency,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      { upsert: true, new: true }
    ).populate("classId", "name");

    return res.status(201).json({
      success: true,
      message: "Fee structure configured successfully",
      data: structure,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create fee structure",
      error: error.message,
    });
  }
};

export const getStudentFeeDetails = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId } = req.params;

    // Student/Parent permission check
    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id, schoolId });
      if (!student || student._id.toString() !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You may only view your own fee records",
        });
      }
    }

    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name")
      .populate("sectionId", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in your school",
      });
    }

    // Get fee structures applicable to this student's class
    const feeStructures = await FeeStructure.find({
      schoolId,
      classId: student.classId._id,
    });

    const totalFeeAmount = feeStructures.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // Get all payments made by this student
    const payments = await FeePayment.find({
      schoolId,
      studentId: student._id,
    })
      .populate("recordedBy", "name")
      .sort({ paymentDate: -1 });

    const totalPaidAmount = payments.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    const pendingBalance = Math.max(0, totalFeeAmount - totalPaidAmount);

    return res.status(200).json({
      success: true,
      data: {
        student,
        feeStructures,
        totalFeeAmount,
        totalPaidAmount,
        pendingBalance,
        payments,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student fee details",
      error: error.message,
    });
  }
};

export const recordPayment = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const {
      studentId,
      amount,
      paymentMethod = "Cash",
      transactionRef = "",
      feeCategory = "Tuition & School Fees",
      remarks = "",
    } = req.body;

    if (!studentId || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId and positive payment amount are required",
      });
    }

    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name")
      .populate("sectionId", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Generate unique sequential receipt number
    const count = await FeePayment.countDocuments({ schoolId });
    const year = new Date().getFullYear();
    const receiptNumber = `RCP-${year}-${String(count + 1).padStart(4, "0")}`;

    const payment = await FeePayment.create({
      schoolId,
      studentId,
      receiptNumber,
      amount: Number(amount),
      paymentMethod,
      transactionRef,
      feeCategory,
      recordedBy: userId,
      remarks,
      paymentDate: new Date(),
    });

    // Notify student/parent
    await Notification.create({
      schoolId,
      recipientId: student.userId,
      title: "Fee Payment Received",
      message: `Payment of ₹${amount} received. Receipt Number: ${receiptNumber}.`,
      type: "Fee",
    });

    return res.status(201).json({
      success: true,
      message: "Fee payment recorded successfully",
      data: {
        payment,
        receiptNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to record payment",
      error: error.message,
    });
  }
};

export const getReceipt = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { receiptNumber } = req.params;

    const payment = await FeePayment.findOne({ schoolId, receiptNumber })
      .populate("studentId")
      .populate("recordedBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    const student = await Student.findById(payment.studentId._id)
      .populate("classId", "name")
      .populate("sectionId", "name");

    const school = await School.findById(schoolId);

    return res.status(200).json({
      success: true,
      data: {
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        transactionRef: payment.transactionRef,
        feeCategory: payment.feeCategory,
        remarks: payment.remarks,
        recordedBy: payment.recordedBy?.name || "School Office",
        school: {
          name: school.name,
          code: school.code,
          phone: school.phone,
          email: school.email,
          address: school.address,
        },
        student: {
          name: `${student.firstName} ${student.lastName || ""}`.trim(),
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          className: student.classId?.name || "N/A",
          sectionName: student.sectionId?.name || "N/A",
          parentName: student.parentName,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch receipt",
      error: error.message,
    });
  }
};
