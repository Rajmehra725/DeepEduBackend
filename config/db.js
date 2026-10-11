import mongoose from "mongoose";
import dns from "dns";

// Force Google DNS for reliable SRV record resolution
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");

    const uri =
      process.env.MONGODB_URI ||
      "mongodb+srv://rajdaheriya725_db_user:yMLrj0XQuO1ffe7O@cluster0.uimztsg.mongodb.net/?appName=Cluster0";

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log("✅ MongoDB Connected");
    console.log("Host:", conn.connection.host);

    // Drop legacy stale indexes if present to prevent conflict
    try {
      const userCollection = mongoose.connection.collection("users");
      const indexes = await userCollection.indexes();
      const hasStaleIndex = indexes.some((idx) => idx.name === "mobileNumber_1");
      if (hasStaleIndex) {
        await userCollection.dropIndex("mobileNumber_1");
        console.log("🧹 Dropped legacy mobileNumber_1 index from users collection");
      }
    } catch (indexErr) {
      // Non-fatal if index cannot be dropped or doesn't exist
    }

    return conn;
  } catch (error) {
    console.error("MongoDB Error:", error);
    process.exit(1);
  }
};

export default connectDB;