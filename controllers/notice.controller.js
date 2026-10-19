import Notice from "../models/Notice.js";

export const getNotices = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userRole = req.user.role;

    // Filter by targetAudience based on role
    const audienceFilter = ["All"];
    if (userRole === "teacher") audienceFilter.push("Teachers");
    if (userRole === "student") audienceFilter.push("Students");
    if (userRole === "parent") audienceFilter.push("Parents");
    if (userRole === "principal" || userRole === "superadmin") {
      audienceFilter.push("Teachers", "Students", "Parents");
    }

    const notices = await Notice.find({
      schoolId,
      targetAudience: { $in: audienceFilter },
    })
      .populate("postedBy", "name role")
      .sort({ publishedDate: -1 });

    return res.status(200).json({
      success: true,
      data: notices,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notices",
      error: error.message,
    });
  }
};

export const createNotice = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const {
      title,
      content,
      targetAudience = "All",
      priority = "Normal",
      attachmentUrl = "",
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Notice title and content are required",
      });
    }

    const notice = await Notice.create({
      schoolId,
      title: title.trim(),
      content: content.trim(),
      targetAudience,
      priority,
      attachmentUrl,
      postedBy: userId,
      publishedDate: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Notice published successfully",
      data: notice,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to publish notice",
      error: error.message,
    });
  }
};

export const deleteNotice = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const deleted = await Notice.findOneAndDelete({ _id: id, schoolId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete notice",
      error: error.message,
    });
  }
};
