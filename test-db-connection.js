require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

console.log("Testing MongoDB Connection...");
console.log("URI:", uri ? uri.replace(/:([^:@]+)@/, ':****@') : "undefined"); // Hide password in logs

if (!uri) {
    console.error("❌ MONGODB_URI is missing in .env.local");
    process.exit(1);
}

mongoose.connect(uri)
    .then(() => {
        console.log("✅ SUCCESS: Connected to MongoDB successfully!");
        console.log("Your password and connection string are correct.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ CONNECTION FAILED:");
        console.error(err.message);
        console.log("\nPossible reasons:");
        console.log("1. Wrong password (is it really 'bala'?)");
        console.log("2. IP Address not whitelisted in MongoDB Atlas (Network Access tab)");
        console.log("3. Wrong cluster address (is it 'cluster0'?)");
        process.exit(1);
    });
