import Certificate from "../models/Certificate.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import { generatePermanentId } from "../utils/idGenerator.js";

const generateCertificateNumber = async (schoolId) => {
  return generatePermanentId(schoolId, "certificate", "CERT");
};

export const listCertificates = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, type, status } = req.query;

    const filter = { schoolId };
    if (studentId) filter.studentId = studentId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    // Student/Parent boundary
    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id, schoolId });
      if (!student) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      filter.studentId = student._id;
    } else if (req.user.role === "parent") {
      const students = await Student.find({
        schoolId,
        $or: [{ parentUserId: req.user._id }, { parentPhone: req.user.phone }],
      });
      const studentIds = students.map((s) => s._id);
      filter.studentId = { $in: studentIds };
    }

    const certificates = await Certificate.find(filter)
      .populate("studentId", "firstName lastName admissionNumber rollNumber classId sectionId")
      .populate("issuedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list certificates",
      error: error.message,
    });
  }
};

export const issueCertificate = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, type, remarks, metadata } = req.body;

    if (!studentId || !type) {
      return res.status(400).json({
        success: false,
        message: "studentId and certificate type are required",
      });
    }

    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name")
      .populate("sectionId", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in this school",
      });
    }

    const certificateNumber = await generateCertificateNumber(schoolId);

    const certificate = await Certificate.create({
      schoolId,
      studentId: student._id,
      certificateNumber,
      type,
      remarks: remarks || "",
      issuedBy: req.user._id,
      status: "Issued",
      metadata: {
        studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        className: student.classId?.name || "",
        sectionName: student.sectionId?.name || "",
        parentName: student.parentName,
        dateOfBirth: student.dateOfBirth,
        ...metadata,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Certificate issued successfully",
      data: certificate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to issue certificate",
      error: error.message,
    });
  }
};

export const getCertificateById = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const cert = await Certificate.findOne({ _id: id, schoolId })
      .populate("studentId")
      .populate("issuedBy", "name email");

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: cert,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch certificate",
      error: error.message,
    });
  }
};

export const getPrintableCertificateHTML = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const cert = await Certificate.findOne({ _id: id, schoolId })
      .populate("studentId")
      .populate("issuedBy", "name email");

    if (!cert) {
      return res.status(404).send("<h3>Certificate not found</h3>");
    }

    const school = await School.findById(schoolId);
    const m = cert.metadata || {};
    const issueDateStr = new Date(cert.issueDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${cert.type} - ${cert.certificateNumber}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body {
      font-family: 'Georgia', serif;
      margin: 0;
      padding: 20px;
      background: #f8fafc;
      color: #1e293b;
    }
    .cert-frame {
      border: 8px double #1e3a8a;
      padding: 30px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      position: relative;
      text-align: center;
    }
    .school-name {
      font-size: 32px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    .school-meta {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
    }
    .cert-title {
      font-size: 24px;
      font-weight: 700;
      color: #b91c1c;
      text-transform: uppercase;
      border-bottom: 2px solid #b91c1c;
      display: inline-block;
      padding-bottom: 6px;
      margin-bottom: 24px;
    }
    .cert-number {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 20px;
      font-family: monospace;
      font-weight: bold;
    }
    .cert-body {
      font-size: 16px;
      line-height: 2.2;
      color: #334155;
      max-width: 800px;
      margin: 0 auto 30px auto;
      text-align: justify;
    }
    .highlight {
      font-weight: bold;
      color: #0f172a;
      border-bottom: 1px dotted #334155;
      padding: 0 4px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
      padding: 0 40px;
    }
    .sig-box {
      text-align: center;
      width: 200px;
    }
    .sig-line {
      border-top: 1px solid #475569;
      margin-top: 50px;
      padding-top: 6px;
      font-size: 13px;
      font-weight: bold;
      color: #334155;
    }
    .seal-circle {
      width: 90px;
      height: 90px;
      border: 2px dashed #94a3b8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #94a3b8;
      margin: 0 auto;
    }
    @media print {
      body { background: transparent; padding: 0; }
      .cert-frame { box-shadow: none; border-color: #1e3a8a; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: right;">
    <button onclick="window.print()" style="padding: 10px 20px; background: #1e3a8a; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Print Certificate
    </button>
  </div>
  <div class="cert-frame">
    <div class="school-name">${school?.name || "DeepEdu Academy"}</div>
    <div class="school-meta">${school?.address || "CBSE Affiliated Institution"} | Phone: ${school?.phone || "N/A"}</div>
    
    <div class="cert-number">Certificate No: ${cert.certificateNumber} | Date: ${issueDateStr}</div>
    <div class="cert-title">${cert.type}</div>

    <div class="cert-body">
      This is to certify that <span class="highlight">${m.studentName || "The Student"}</span>, 
      Son/Daughter of Shri <span class="highlight">${m.parentName || "Parent / Guardian"}</span>, 
      bearing Admission No: <span class="highlight">${m.admissionNumber || "N/A"}</span> 
      and Roll No: <span class="highlight">${m.rollNumber || "N/A"}</span>, is/was a bonafide student of 
      <span class="highlight">${school?.name || "this Academy"}</span> studying in 
      <span class="highlight">${m.className || "Standard"}</span> (Section: <span class="highlight">${m.sectionName || "A"}</span>).
      <br/><br/>
      ${cert.remarks || "During their tenure at this institution, their conduct and character have been found to be exemplary. We wish them all success in their future academic endeavors."}
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line">Prepared By</div>
        <div style="font-size: 11px; color: #64748b;">${cert.issuedBy?.name || "Registrar"}</div>
      </div>
      <div class="seal-circle">
        OFFICIAL SEAL
      </div>
      <div class="sig-box">
        <div class="sig-line">Principal / Headmaster</div>
        <div style="font-size: 11px; color: #64748b;">${school?.name || "DeepEdu Academy"}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send("<h3>Failed to generate certificate preview</h3>");
  }
};

export const revokeCertificate = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { reason } = req.body;

    const cert = await Certificate.findOneAndUpdate(
      { _id: id, schoolId },
      {
        status: "Revoked",
        remarks: reason ? `[REVOKED: ${reason}]` : "[REVOKED]",
      },
      { new: true }
    );

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate revoked successfully",
      data: cert,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to revoke certificate",
      error: error.message,
    });
  }
};
