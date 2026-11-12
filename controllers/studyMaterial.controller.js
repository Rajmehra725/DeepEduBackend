import StudyMaterial from "../models/StudyMaterial.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Notification from "../models/Notification.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";

/**
 * Fetch study materials (accessible to Students, Teachers, Parents, Principals)
 */
export const getStudyMaterials = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId, subjectId, category, search } = req.query;

    const query = { schoolId, status: "Active" };

    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id, schoolId });
      if (student) {
        query.classId = student.classId;
      }
    } else if (classId) {
      query.classId = classId;
    }

    if (sectionId) {
      query.$or = [{ sectionId }, { sectionId: null }];
    }

    if (subjectId) {
      query.subjectId = subjectId;
    }

    if (category && category !== "all") {
      query.category = category;
    }

    if (search) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const materials = await StudyMaterial.find(query)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("subjectId", "name code type")
      .populate("teacherId", "firstName lastName employeeId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: materials,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch study materials",
      error: error.message,
    });
  }
};

/**
 * Upload / Create new study material (Teacher or Principal)
 */
export const createStudyMaterial = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const {
      classId,
      sectionId = null,
      subjectId,
      title,
      description = "",
      category = "Notes",
      fileUrl = "",
      fileName = "",
      fileType = "pdf",
      videoUrl = "",
    } = req.body;

    if (!classId || !subjectId || !title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "classId, subjectId, and title are required",
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

      // Verify assignment
      const isAssigned = await ClassSubjectTeacher.findOne({
        schoolId,
        classId,
        subjectId,
        teacherId: teacher._id,
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not assigned to teach this subject to this class",
        });
      }
    } else {
      teacher = await Teacher.findOne({ schoolId });
    }

    const material = await StudyMaterial.create({
      schoolId,
      classId,
      sectionId: sectionId || null,
      subjectId,
      teacherId: teacher?._id,
      title: title.trim(),
      description: description.trim(),
      category,
      fileUrl,
      fileName: fileName.trim(),
      fileType,
      videoUrl: videoUrl.trim(),
      status: "Active",
    });

    const populated = await StudyMaterial.findById(material._id)
      .populate("classId", "name")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName");

    // Notify students
    const studentQuery = { schoolId, classId, status: "active" };
    if (sectionId) studentQuery.sectionId = sectionId;
    const students = await Student.find(studentQuery);

    for (const st of students) {
      await Notification.create({
        schoolId,
        recipientId: st.userId,
        title: `New Study Material: ${title.trim()}`,
        message: `New ${category} uploaded for ${populated.subjectId?.name || "your subject"}. Tap to download or review.`,
        type: "Academics",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Study material published to digital classroom successfully",
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to publish study material",
      error: error.message,
    });
  }
};

/**
 * Update study material
 */
export const updateStudyMaterial = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { title, description, category, fileUrl, fileName, fileType, videoUrl } = req.body;

    const query = { _id: id, schoolId };
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ userId: req.user._id, schoolId });
      query.teacherId = teacher?._id;
    }

    const material = await StudyMaterial.findOne(query);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found or unauthorized to edit",
      });
    }

    if (title) material.title = title.trim();
    if (description !== undefined) material.description = description.trim();
    if (category) material.category = category;
    if (fileUrl !== undefined) material.fileUrl = fileUrl;
    if (fileName !== undefined) material.fileName = fileName.trim();
    if (fileType) material.fileType = fileType;
    if (videoUrl !== undefined) material.videoUrl = videoUrl.trim();

    await material.save();

    return res.status(200).json({
      success: true,
      message: "Study material updated successfully",
      data: material,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update study material",
      error: error.message,
    });
  }
};

/**
 * Delete / Archive study material
 */
export const deleteStudyMaterial = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const query = { _id: id, schoolId };
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ userId: req.user._id, schoolId });
      query.teacherId = teacher?._id;
    }

    const deleted = await StudyMaterial.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Study material not found or unauthorized to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Study material removed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete study material",
      error: error.message,
    });
  }
};
