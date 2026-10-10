import TimeCapsule from "../models/timeCapsule.model.js";

/**
 * Create a new Time Capsule message
 */
export const createCapsule = async (req, res) => {
  try {
    const {
      recipientId,
      deliverAt,
      title = "Time Capsule",
      message,
      mediaUrl = "",
      isSelfCapsule = false,
      occasion = "general",
    } = req.body;

    const currentUserId = req.user._id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Capsule message is required" });
    }

    if (!deliverAt) {
      return res.status(400).json({ success: false, message: "deliverAt delivery date is required" });
    }

    const deliveryDate = new Date(deliverAt);
    if (deliveryDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Delivery date must be in the future",
      });
    }

    const targetRecipient = isSelfCapsule ? currentUserId : recipientId || currentUserId;

    const capsule = new TimeCapsule({
      sender: currentUserId,
      recipient: targetRecipient,
      title: title.trim(),
      message: message.trim(),
      mediaUrl,
      deliverAt: deliveryDate,
      isSelfCapsule: Boolean(isSelfCapsule),
      occasion,
      status: "pending",
    });

    await capsule.save();

    return res.status(201).json({
      success: true,
      message: "Time Capsule sealed! Will be delivered on the designated date.",
      capsule,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get user's active capsules (both created and received)
 */
export const getMyCapsules = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const sent = await TimeCapsule.find({
      sender: currentUserId,
    })
      .populate("recipient", "fullName username profileImage")
      .sort({ deliverAt: 1 });

    const received = await TimeCapsule.find({
      recipient: currentUserId,
      status: "delivered",
    })
      .populate("sender", "fullName username profileImage")
      .sort({ deliveredAt: -1 });

    return res.status(200).json({
      success: true,
      sent,
      received,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel a pending capsule
 */
export const cancelCapsule = async (req, res) => {
  try {
    const { capsuleId } = req.params;
    const currentUserId = req.user._id;

    const capsule = await TimeCapsule.findOne({
      _id: capsuleId,
      sender: currentUserId,
      status: "pending",
    });

    if (!capsule) {
      return res.status(404).json({ success: false, message: "Pending capsule not found" });
    }

    capsule.status = "cancelled";
    await capsule.save();

    return res.status(200).json({
      success: true,
      message: "Time Capsule cancelled",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
