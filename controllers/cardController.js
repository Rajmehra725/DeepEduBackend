import Card from "../models/Card.js";


 export const createCard = async (req, res) => {
  try {
    console.log("BODY =>", req.body);
    console.log("FILES =>", req.files);

    const {
      name,
      fatherName,
      phone,
      dob,
      district,
      state,
      address,
      aadhaar,
    } = req.body;


    const profileImage =
      req.files?.profileImage?.[0]?.path || "";

    const aadhaarImage =
      req.files?.aadhaarImage?.[0]?.path || "";
 const cardNumber =
      "SC" + Date.now().toString().slice(-8);
    const card = await Card.create({
      name,
      fatherName,
      phone,
      dob,
      district,
      state,
      address,
      aadhaar,
      profileImage,
      aadhaarImage,
      cardNumber,
    });

    res.status(201).json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCards = async (req, res) => {
  try {
    const cards = await Card.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: cards,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCard = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    res.status(200).json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const card = await Card.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      {
        new: true,
      }
    );

    res.status(200).json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteCard = async (req, res) => {
  try {
    await Card.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Deleted Successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};