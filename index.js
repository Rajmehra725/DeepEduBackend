import dotenv from "dotenv";
dotenv.config();

import express from "express";




import connectDB from "./config/db.js";



const app = express();


// ================= DATABASE & START SERVER =================
const PORT = process.env.PORT || 5000;

connectDB().then(() => {

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 DeepEdu Backend Running on http://localhost:${PORT}`);
  });
});