require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const seedAdmin = async () => {
  try {
    if (!ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD must be set before seeding the admin account");
    }

    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() }).select("+password");

    if (existingAdmin) {
      const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.password);
      if (!passwordMatches) {
        existingAdmin.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
      }
      if (existingAdmin.role !== "Admin") existingAdmin.role = "Admin";
      if (existingAdmin.status !== "Active") existingAdmin.status = "Active";
      if (existingAdmin.department !== "Management") existingAdmin.department = "Management";
      await existingAdmin.save();
      console.log(`Admin account is ready: ${ADMIN_EMAIL}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = await User.create({
      name: "Admin",
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: "Admin",
      industry: "IT",
      department: "Management",
      status: "Active",
    });

    console.log("Admin account created successfully:");
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();
