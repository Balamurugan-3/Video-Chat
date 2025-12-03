import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/db";
import User from "@/models/User";

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }));
} else {
    // Fallback provider to prevent NextAuth from crashing
    providers.push(CredentialsProvider({
        name: "Guest",
        credentials: {},
        async authorize() {
            return null;
        }
    }));
}

const handler = NextAuth({
    providers,
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async signIn({ user, account, profile }: any) {
            if (account?.provider === "google") {
                try {
                    await dbConnect();

                    // Find or create user in database
                    let dbUser = await User.findOne({ googleId: account.providerAccountId });

                    if (!dbUser) {
                        // Create new user
                        dbUser = await User.create({
                            googleId: account.providerAccountId,
                            email: user.email,
                            name: user.name,
                            picture: user.image,
                        });
                        console.log("✅ New user created:", user.email);
                    } else {
                        // Update last login
                        dbUser.lastLogin = new Date();
                        await dbUser.save();
                        console.log("✅ User logged in:", user.email);
                    }
                } catch (error) {
                    console.error("❌ Error saving user to database:", error);
                }
            }
            return true;
        },
        async session({ session, token }: any) {
            if (session.user) {
                // Add user ID to session
                session.user.id = token.sub;

                // Get user from database to add googleId
                try {
                    await dbConnect();
                    const dbUser = await User.findOne({ email: session.user.email });
                    if (dbUser) {
                        session.user.googleId = dbUser.googleId;
                        session.user.dbId = dbUser._id.toString();
                    }
                } catch (error) {
                    console.error("❌ Error fetching user from database:", error);
                }
            }
            return session;
        }
    }
});

export { handler as GET, handler as POST };
