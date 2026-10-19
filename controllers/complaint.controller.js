import Complaint from "../models/Complaint.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

export const createComplaint = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { title, category, description, teacherId, attachmentUrl = "" } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // Resolve student record for this user
    let student = await Student.findOne({ userId, schoolId });
    if (!student && req.user.role === "parent") {
      student = await Student.findOne({
        schoolId,
        $or: [{ parentUserId: userId }, { parentPhone: req.user.phone }],
      });
    }

    if (!student) {
      return res.status(403).json({
        success: false,
        message: "No registered student profile linked to your account",
      });
    }

    const complaint = await Complaint.create({
      schoolId,
      studentId: student._id,
      studentUserId: userId,
      teacherId: teacherId || null,
      title: title.trim(),
      category: category || "Academic issue",
      description: description.trim(),
      attachmentUrl,
      status: "Submitted",
      history: [
        {
          status: "Submitted",
          changedBy: userId,
          note: "Complaint submitted by student/parent",
          timestamp: new Date(),
        },
      ],
    });

    // Notify School Principal
    const principals = await User.find({ schoolId, role: "principal" });
    for (const pr of principals) {
      await Notification.create({
        schoolId,
        recipientId: pr._id,
        title: "New Shikayat / Complaint Received",
        message: `A new complaint "${title}" was filed by ${student.firstName}.`,
        type: "Complaint",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Your complaint (shikayat) has been submitted successfully",
      data: complaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit complaint",
      error: error.message,
    });
  }
};

export const getMyComplaints = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    const complaints = await Complaint.find({
      schoolId,
      studentUserId: userId,
    })
      .populate("teacherId", "firstName lastName designation")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: complaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints",
      error: error.message,
    });
  }
};

export const getAssignedComplaints = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: "No teacher profile found",
      });
    }

    // Teachers only see complaints explicitly assigned to them by Principal
    const complaints = await Complaint.find({
      schoolId,
      teacherId: teacher._id,
      status: { $in: ["Assigned", "In Progress", "Resolved"] },
    })
      .populate("studentId", "firstName lastName admissionNumber")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: complaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned complaints",
      error: error.message,
    });
  }
};

export const getAllComplaints = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { status, category, search = "", page = 1, limit = 10 } = req.query;

    const query = { schoolId };
    if (status && status !== "all") query.status = status;
    if (category && category !== "all") query.category = category;
    if (search) {
      query.title = { $regex: search.trim(), $options: "i" };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await Complaint.countDocuments(query);
    const complaints = await Complaint.find(query)
      .populate("studentId", "firstName lastName admissionNumber classId sectionId")
      .populate("teacherId", "firstName lastName employeeId designation")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      data: {
        complaints,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints",
      error: error.message,
    });
  }
};

export const updateComplaintStatus = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { id } = req.params;
    const { status, teacherId, adminNotes, resolutionReason } = req.body;

    const complaint = await Complaint.findOne({ _id: id, schoolId });
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found in your school",
      });
    }

    if (status) complaint.status = status;
    if (teacherId !== undefined) complaint.teacherId = teacherId || null;
    if (adminNotes !== undefined) complaint.adminNotes = adminNotes;
    if (resolutionReason !== undefined) complaint.resolutionReason = resolutionReason;

    complaint.history.push({
      status: status || complaint.status,
      changedBy: userId,
      note: adminNotes || resolutionReason || `Status updated to ${status}`,
      timestamp: new Date(),
    });

    await complaint.save();

    // Notify student of status update
    await Notification.create({
      schoolId,
      recipientId: complaint.studentUserId,
      title: `Complaint Status Update: ${complaint.title}`,
      message: `Your complaint status is now '${complaint.status}'. ${resolutionReason ? "Resolution: " + resolutionReason : ""}`,
      type: "Complaint",
    });

    return res.status(200).json({
      success: true,
      message: "Complaint status updated successfully",
      data: complaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update complaint",
      error: error.message,
    });
  }
};
