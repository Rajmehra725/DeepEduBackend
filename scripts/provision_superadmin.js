import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";

async function provisionSuperAdmin() {
  try {
    await connectDB();
    console.log("Connected to MongoDB.");

    const targetIdentifier = process.argv[2] || process.env.SUPERADMIN_USERNAME || "raazadmin";
    const defaultPassword = process.env.SUPERADMIN_PASSWORD || "RaazChat@Admin2026";
    const defaultPhone = process.env.SUPERADMIN_PHONE || "+919999999999";

    let adminUser = await User.findOne({
      $or: [
        { username: targetIdentifier.toLowerCase().replace(/^@+/, "") },
        { phone: targetIdentifier },
        { role: "super_admin" },
      ],
    });

    if (adminUser) {
      adminUser.role = "super_admin";
      adminUser.isPrimarySuperAdmin = true;
      adminUser.isBanned = false;
      adminUser.isSuspended = false;
      await adminUser.save();

      console.log(`✅ User @${adminUser.username} (${adminUser.phone}) successfully provisioned as SUPER ADMIN.`);
      
      await AuditLog.create({
        admin: adminUser._id,
        action: "PROVISION_SUPER_ADMIN",
        targetType: "User",
        targetId: adminUser._id.toString(),
        details: { username: adminUser.username, note: "Server-side provisioning script execution" },
        ipAddress: "127.0.0.1",
      });
    } else {
      adminUser = new User({
        fullName: "RaazChat Super Admin",
        username: "raazadmin",
        phone: defaultPhone,
        password: defaultPassword,
        role: "super_admin",
        isPrimarySuperAdmin: true,
        bio: "Platform Administrator for RaazChat Pro.",
      });

      await adminUser.save();
      console.log(`✅ Created new Super Admin account: @raazadmin (${defaultPhone})`);

      await AuditLog.create({
        admin: adminUser._id,
        action: "PROVISION_SUPER_ADMIN",
        targetType: "User",
        targetId: adminUser._id.toString(),
        details: { username: "raazadmin", note: "Initial server provisioning script creation" },
        ipAddress: "127.0.0.1",
      });
    }

    console.log("Provisioning complete. Closing connection.");
    process.exit(0);
  } catch (error) {
    console.error("Provisioning failed:", error);
    process.exit(1);
  }
}

provisionSuperAdmin();
