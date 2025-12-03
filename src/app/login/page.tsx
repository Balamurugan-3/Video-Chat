"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);

    const handleLogin = () => {
        setLoading(true);
        signIn("google", { callbackUrl: "/chat" });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-secondary/50 p-8 backdrop-blur-xl border border-white/10 shadow-2xl">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Sign in to start chatting with random people
                    </p>
                </div>
                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/20 disabled:opacity-50 cursor-pointer"
                >
                    {loading ? "Connecting..." : "Sign in with Google"}
                </button>
            </div>
        </div>
    );
}
