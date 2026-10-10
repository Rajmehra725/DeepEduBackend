import axios from "axios";
import { createServer } from "http";
import express from "express";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import MoodEntry from "../models/mood.model.js";
import Notification from "../models/notification.model.js";

import authRoutes from "../routes/auth.routes.js";
import userRoutes from "../routes/user.routes.js";
import postRoutes from "../routes/post.routes.js";
import moodRoutes from "../routes/mood.routes.js";
import notificationRoutes from "../routes/notification.routes.js";

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function runSmileyXVerification() {
  console.log("=================================================");
  console.log("   SMILEYX: PLATFORM & NEW MODULES VERIFICATION   ");
  console.log("=================================================");

  // 1. Connect DB
  await connectDB();
  console.log("✅ Step 1: MongoDB Database Connected");

  // 2. Start test server
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/mood", moodRoutes);
  app.use("/api/notifications", notificationRoutes);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✅ Step 2: SmileyX Test Server Running on port ${TEST_PORT}`);

  const testSuffix = Date.now().toString().slice(-6);
  const usernameA = `smiley_${testSuffix}`;
  const emailA = `smiley_${testSuffix}@example.com`;
  const password = "BlueJayPassword123!";

  // 3. Test Username Availability API
  const availRes = await axios.get(`${BASE_URL}/auth/check-username?username=${usernameA}`);
  if (!availRes.data.success || !availRes.data.available) {
    throw new Error("Username availability check failed");
  }
  console.log(`✅ Step 3: Username Availability Check Verified (@${usernameA} is available)`);

  // 4. Test Email Registration Without OTP
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    fullName: "Blue Jay Tester",
    username: usernameA,
    email: emailA,
    password,
    confirmPassword: password,
    termsAccepted: true,
  });

  if (!regRes.data.success || !regRes.data.token) {
    throw new Error("Email registration without OTP failed");
  }
  const token = regRes.data.token;
  const userId = regRes.data.user._id;
  console.log(`✅ Step 4: Email Registration Without OTP Verified (${emailA})`);

  // 5. Test Live Check Taken Username
  const takenRes = await axios.get(`${BASE_URL}/auth/check-username?username=${usernameA}`);
  if (takenRes.data.available !== false) {
    throw new Error("Registered username should be marked as taken");
  }
  console.log(`✅ Step 5: Duplicate Username Rejection Confirmed (@${usernameA} now taken)`);

  // 6. Test Email + Password Login
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    identifier: emailA,
    password,
  });
  if (!loginRes.data.success || !loginRes.data.token) {
    throw new Error("Email login failed");
  }
  console.log("✅ Step 6: Email + Password Login Verified");

  // 7. Test Permanent Moment (Post) Creation with Feeling and Poll
  const postRes = await axios.post(
    `${BASE_URL}/posts/create`,
    {
      text: "Hello SmileyX World! Expressing a moment #SmileyMoments #BlueJay",
      feeling: "Happy",
      poll: {
        question: "How is your mood today?",
        options: [{ text: "Amazing 🌟" }, { text: "Chill ☕" }],
      },
      audience: "everyone",
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!postRes.data.success || !postRes.data.post) {
    throw new Error("Post creation failed");
  }
  const postId = postRes.data.post._id;
  const pollOptionId = postRes.data.post.poll.options[0]._id;
  console.log("✅ Step 7: Moment Post Creation with Feelings & Poll Verified");

  // 8. Test Post Reaction
  const reactRes = await axios.post(
    `${BASE_URL}/posts/${postId}/react`,
    { emoji: "❤️" },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!reactRes.data.success || reactRes.data.reactions.length === 0) {
    throw new Error("Post reaction failed");
  }
  console.log("✅ Step 8: Post Reaction Verified (❤️)");

  // 9. Test Poll Voting
  const voteRes = await axios.post(
    `${BASE_URL}/posts/${postId}/poll/${pollOptionId}/vote`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!voteRes.data.success) {
    throw new Error("Poll vote failed");
  }
  console.log("✅ Step 9: Post Poll Voting Verified");

  // 10. Test Commenting on Post
  const commentRes = await axios.post(
    `${BASE_URL}/posts/${postId}/comments`,
    { text: "Love this new SmileyX experience!" },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!commentRes.data.success || !commentRes.data.comment) {
    throw new Error("Commenting failed");
  }
  console.log("✅ Step 10: Comments on Post Verified");

  // 11. Test MoodSpace Private Journal Recording & Retrieval
  const moodRes = await axios.post(
    `${BASE_URL}/mood/record`,
    {
      mood: "excited",
      note: "Building the SmileyX platform with Blue Jay theme!",
      isPrivate: true,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!moodRes.data.success) {
    throw new Error("MoodSpace record failed");
  }

  const historyRes = await axios.get(`${BASE_URL}/mood/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!historyRes.data.success || historyRes.data.history.length === 0) {
    throw new Error("Mood history fetch failed");
  }
  console.log("✅ Step 11: MoodSpace Private Journal Recording & History Verified");

  // 12. Test In-App Notifications Retrieval
  const notifRes = await axios.get(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifRes.data.success) {
    throw new Error("Notifications retrieval failed");
  }
  console.log("✅ Step 12: In-App Notifications API Verified");

  // 13. Test Password Recovery Without OTP (by email)
  const newPassword = "NewSmileyPassword999!";
  const recoverRes = await axios.post(`${BASE_URL}/auth/recover-password`, {
    identifier: emailA,
    newPassword,
  });
  if (!recoverRes.data.success) {
    throw new Error("Password recovery without OTP failed");
  }

  // Confirm login with new password
  const newLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
    identifier: emailA,
    password: newPassword,
  });
  if (!newLoginRes.data.success) {
    throw new Error("Login with recovered password failed");
  }
  console.log("✅ Step 13: Password Recovery Without OTP Verified");

  // Clean up
  server.close();
  console.log("=================================================");
  console.log("🎉 ALL 13 SMILEYX PLATFORM TESTS PASSED! 🎉");
  console.log("=================================================");
  process.exit(0);
}

runSmileyXVerification().catch((err) => {
  console.error("❌ SMILEYX TEST FAILED:", err?.response?.data || err.message);
  process.exit(1);
});
