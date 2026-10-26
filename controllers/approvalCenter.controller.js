import bcrypt from "bcryptjs";
import RegistrationRequest from "../models/RegistrationRequest.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Counter from "../models/Counter.js";
import { generatePermanentId } from "../utils/idGenerator.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Public: Verify School by Code or ID
 */
export const verifySchool = async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ success: false, message: "School identifier is required" });
    }

    const school = await School.findOne({
      $or: [
        { code: identifier.toUpperCase().trim() },
        { permanentSchoolId: identifier.trim() },
        ...(identifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: identifier }] : []),
      ],
    }).select("name code permanentSchoolId logo address allowSelfRegistration status currentSessionId");

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found. Please verify the School Code or ID with your institution.",
      });
    }

    if (school.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "School access is currently suspended. Registrations cannot be processed.",
      });
    }

    return res.status(200).json({
      success: true,
      data: school,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Verification failed", error: error.message });
  }
};

/**
 * Public: Submit Teacher Self-Registration Request
 */
export const submitTeacherRegistrationRequest = async (req, res) => {
  try {
    const {
      schoolIdentifier,
      name,
      email,
      phone,
      password,
      qualifications,
      experience,
      designation,
      subjectSpecialization,
    } = req.body;

    if (!schoolIdentifier || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "School ID/Code, full name, official email, and password are required",
      });
    }

    const school = await School.findOne({
      $or: [
        { code: schoolIdentifier.toUpperCase().trim() },
        { permanentSchoolId: schoolIdentifier.trim() },
        ...(schoolIdentifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: schoolIdentifier }] : []),
      ],
    });

    if (!school) {
      return res.status(404).json({ success: false, message: "School not found" });
    }

    if (!school.allowSelfRegistration) {
      return res.status(403).json({
        success: false,
        message: "Self-registration is disabled for this school. Please contact the Principal.",
      });
    }

    // Check duplicate email in users or pending requests
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }

    const existingPending = await RegistrationRequest.findOne({
      schoolId: school._id,
      email: email.toLowerCase().trim(),
      status: "Pending",
    });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "A pending registration request with this email is already awaiting review.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const request = await RegistrationRequest.create({
      schoolId: school._id,
      type: "Teacher",
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      password: hashedPassword,
      qualifications: qualifications?.trim() || "",
      experience: experience?.trim() || "",
      designation: designation?.trim() || "Teacher",
      subjectSpecialization: subjectSpecialization?.trim() || "",
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message: "Teacher registration request submitted successfully! It is pending approval by the Principal.",
      data: {
        requestId: request._id,
        schoolName: school.name,
        name: request.name,
        status: request.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
};

/**
 * Public: Submit Student Admission Self-Registration Request
 */
export const submitStudentRegistrationRequest = async (req, res) => {
  try {
    const {
      schoolIdentifier,
      name,
      parentName,
      parentPhone,
      parentEmail,
      classId,
      sectionId,
      address,
    } = req.body;

    if (!schoolIdentifier || !name || !parentName || !parentPhone) {
      return res.status(400).json({
        success: false,
        message: "School Code, student name, parent name, and parent phone are required",
      });
    }

    const school = await School.findOne({
      $or: [
        { code: schoolIdentifier.toUpperCase().trim() },
        { permanentSchoolId: schoolIdentifier.trim() },
        ...(schoolIdentifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: schoolIdentifier }] : []),
      ],
    });

    if (!school) {
      return res.status(404).json({ success: false, message: "School not found" });
    }

    const request = await RegistrationRequest.create({
      schoolId: school._id,
      type: "Student",
      name: name.trim(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parentEmail: parentEmail?.toLowerCase().trim() || "",
      classId: classId || null,
      sectionId: sectionId || null,
      address: address?.trim() || "",
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message: "Student admission request submitted! The Principal will review your application.",
      data: {
        requestId: request._id,
        schoolName: school.name,
        studentName: request.name,
        status: request.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Admission request failed", error: error.message });
  }
};

/**
 * Principal: List Pending Registration Requests for School
 */
export const getPendingRequests = async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = { schoolId: req.schoolId };

    if (type) filter.type = type;
    if (status) filter.status = status;
    else filter.status = "Pending";

    const requests = await RegistrationRequest.find(filter)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch requests", error: error.message });
  }
};

/**
 * Principal: Review (Approve / Reject / Changes Requested) Request
 */
export const reviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reviewReason } = req.body;

    if (!action || !["approve", "reject", "changes_requested"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve', 'reject', or 'changes_requested'",
      });
    }

    const request = await RegistrationRequest.findOne({ _id: id, schoolId: req.schoolId });
    if (!request) {
      return res.status(404).json({ success: false, message: "Registration request not found" });
    }

    if (request.status === "Approved") {
      return res.status(400).json({ success: false, message: "This request has already been approved." });
    }

    if (action === "reject") {
      request.status = "Rejected";
      request.reviewReason = reviewReason || "Application not accepted";
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      await request.save();

      await AuditLog.create({
        schoolId: req.schoolId,
        userId: req.user._id,
        action: "REGISTRATION_REQUEST_REJECTED",
        entity: "RegistrationRequest",
        entityId: request._id.toString(),
        details: { type: request.type, name: request.name, reason: request.reviewReason },
        ipAddress: req.ip || "",
      });

      return res.status(200).json({
        success: true,
        message: `${request.type} registration request rejected`,
        data: request,
      });
    }

    if (action === "changes_requested") {
      request.status = "Changes Requested";
      request.reviewReason = reviewReason || "Please update provided information";
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      await request.save();

      return res.status(200).json({
        success: true,
        message: `Changes requested from ${request.type.toLowerCase()} applicant`,
        data: request,
      });
    }

    // ACTION: APPROVE
    if (request.type === "Teacher") {
      const permanentId = await generatePermanentId(req.schoolId, "teacher", "TCH");
      const employeeId = `EMP-${Date.now().toString().slice(-4)}`;

      // Create User
      const newUser = new User({
        name: request.name,
        email: request.email,
        password: request.password, // already hashed, pre-save hook detects $2b$
        role: "teacher",
        schoolId: req.schoolId,
        phone: request.phone,
        status: "active",
      });
      await newUser.save();

      // Split name into first and last
      const nameParts = request.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "Faculty";

      const teacher = await Teacher.create({
        schoolId: req.schoolId,
        userId: newUser._id,
        employeeId,
        permanentId,
        firstName,
        lastName,
        email: request.email,
        phone: request.phone,
        designation: request.designation || "Senior Teacher",
        qualification: request.qualifications || "Post Graduate",
        status: "active",
      });

      request.status = "Approved";
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      await request.save();

      await AuditLog.create({
        schoolId: req.schoolId,
        userId: req.user._id,
        action: "TEACHER_APPROVED",
        entity: "Teacher",
        entityId: teacher._id.toString(),
        details: { permanentId, employeeId, name: request.name },
        ipAddress: req.ip || "",
      });

      return res.status(200).json({
        success: true,
        message: `Teacher ${request.name} approved! Permanent ID assigned: ${permanentId}`,
        data: {
          teacher,
          permanentId,
          status: "Approved",
          user: { id: newUser._id, email: newUser.email, role: newUser.role },
        },
      });
    }

    if (request.type === "Student") {
      // Check Subscription Limit
      const [currentStudentCount, subscription] = await Promise.all([
        Student.countDocuments({ schoolId: req.schoolId, status: "active" }),
        Subscription.findOne({ schoolId: req.schoolId }),
      ]);

      const maxLimit = subscription?.studentLimit || 750;
      if (currentStudentCount >= maxLimit) {
        return res.status(403).json({
          success: false,
          message: `Subscription limit reached (${currentStudentCount}/${maxLimit} students). Please upgrade school plan in Super Admin before admitting new students.`,
        });
      }

      const permanentId = await generatePermanentId(req.schoolId, "student", "STU");
      const admissionNumber = `ADM-${Date.now().toString().slice(-4)}`;

      // Split name
      const nameParts = request.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "Student";

      // Create student user account
      const studentEmail = `stu.${permanentId.toLowerCase()}@school.edu`;

      const studentUser = new User({
        name: request.name,
        email: studentEmail,
        password: "Student@123",
        role: "student",
        schoolId: req.schoolId,
        phone: request.parentPhone,
        status: "active",
      });
      await studentUser.save();

      // Check or create Parent User
      let parentUser = null;
      if (request.parentEmail) {
        parentUser = await User.findOne({
          role: "parent",
          email: request.parentEmail.toLowerCase().trim(),
        });
      }
      if (!parentUser && request.parentPhone) {
        parentUser = await User.findOne({
          role: "parent",
          phone: request.parentPhone.trim(),
        });
      }

      if (!parentUser && (request.parentEmail || request.parentPhone)) {
        const parentEmail = request.parentEmail
          ? request.parentEmail.toLowerCase().trim()
          : `parent.${Date.now()}@school.edu`;
        parentUser = new User({
          name: request.parentName,
          email: parentEmail,
          password: "Parent@123",
          role: "parent",
          schoolId: req.schoolId,
          phone: request.parentPhone,
          status: "active",
          linkedStudents: [],
        });
        await parentUser.save();
      }

      const student = await Student.create({
        schoolId: req.schoolId,
        userId: studentUser._id,
        admissionNumber,
        permanentId,
        rollNumber: String(currentStudentCount + 1),
        firstName,
        lastName,
        classId: request.classId,
        sectionId: request.sectionId,
        parentName: request.parentName,
        parentPhone: request.parentPhone,
        parentEmail: request.parentEmail || "",
        parentUserId: parentUser ? parentUser._id : null,
        address: request.address || "",
        status: "active",
      });

      // Link student to parent
      if (parentUser) {
        if (!parentUser.linkedStudents.includes(student._id)) {
          parentUser.linkedStudents.push(student._id);
          await parentUser.save();
        }
      }

      request.status = "Approved";
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      await request.save();

      await AuditLog.create({
        schoolId: req.schoolId,
        userId: req.user._id,
        action: "STUDENT_ADMISSION_APPROVED",
        entity: "Student",
        entityId: student._id.toString(),
        details: { permanentId, admissionNumber, name: request.name },
        ipAddress: req.ip || "",
      });

      return res.status(200).json({
        success: true,
        message: `Student ${request.name} admission approved! Permanent ID: ${permanentId}`,
        data: {
          student,
          permanentId,
          loginEmail: studentEmail,
        },
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Review action failed", error: error.message });
  }
};
