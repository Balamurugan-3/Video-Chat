"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Dashboard data
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [chats, setChats] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [selectedChat, setSelectedChat] = useState<any>(null);

    // Check if already authenticated
    useEffect(() => {
        const auth = localStorage.getItem("adminAuth");
        if (auth) {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem("adminAuth", password);
                setIsAuthenticated(true);
                fetchDashboardData();
            } else {
                setError(data.error || "Authentication failed");
            }
        } catch (err) {
            setError("Connection error");
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboardData = async () => {
        const authToken = localStorage.getItem("adminAuth");

        try {
            const statsRes = await fetch("/api/admin/stats", {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }

            const usersRes = await fetch("/api/admin/users?limit=100", {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.users);
            }

            const chatsRes = await fetch("/api/admin/chats?limit=100", {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            if (chatsRes.ok) {
                const data = await chatsRes.json();
                setChats(data.chats);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    const toggleBan = async (userId: string) => {
        const authToken = localStorage.getItem("adminAuth");

        try {
            const res = await fetch(`/api/admin/users/${userId}/ban`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            if (res.ok) {
                fetchDashboardData(); // Refresh data
            }
        } catch (err) {
            console.error("Error toggling ban:", err);
        }
    };

    const viewChatTranscript = async (chatId: string) => {
        const authToken = localStorage.getItem("adminAuth");

        try {
            const res = await fetch(`/api/admin/chats/${chatId}`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            if (res.ok) {
                const data = await res.json();
                setSelectedChat(data.chat);
            }
        } catch (err) {
            console.error("Error fetching chat:", err);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchDashboardData();
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-secondary/50 p-8 rounded-2xl border border-white/10">
                    <h1 className="text-3xl font-bold text-foreground mb-6">Admin Login</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-2 block">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-primary outline-none"
                                placeholder="Enter admin password"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? "Authenticating..." : "Login"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="bg-secondary/50 border-b border-white/10 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                    <button
                        onClick={() => {
                            localStorage.removeItem("adminAuth");
                            setIsAuthenticated(false);
                        }}
                        className="text-sm text-gray-400 hover:text-white"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-white/10">
                <div className="max-w-7xl mx-auto flex gap-4 p-4">
                    {["dashboard", "users", "chats"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-medium capitalize ${activeTab === tab
                                    ? "bg-primary text-white"
                                    : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto p-4">
                {activeTab === "dashboard" && stats && (
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-secondary/30 p-6 rounded-lg border border-white/10">
                                <p className="text-gray-400 text-sm">Total Users</p>
                                <p className="text-3xl font-bold mt-2">{stats.stats.totalUsers}</p>
                            </div>
                            <div className="bg-secondary/30 p-6 rounded-lg border border-white/10">
                                <p className="text-gray-400 text-sm">Active (24h)</p>
                                <p className="text-3xl font-bold mt-2">{stats.stats.activeUsers}</p>
                            </div>
                            <div className="bg-secondary/30 p-6 rounded-lg border border-white/10">
                                <p className="text-gray-400 text-sm">Chats Today</p>
                                <p className="text-3xl font-bold mt-2">{stats.stats.chatsToday}</p>
                            </div>
                            <div className="bg-secondary/30 p-6 rounded-lg border border-white/10">
                                <p className="text-gray-400 text-sm">Total Chats</p>
                                <p className="text-3xl font-bold mt-2">{stats.stats.totalChats}</p>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-secondary/30 p-6 rounded-lg border border-white/10">
                                <h3 className="text-lg font-semibold mb-4">User Signups (Last 7 Days)</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={stats.charts.signupData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                        <XAxis dataKey="_id" stroke="#888" />
                                        <YAxis stroke="#888" />
                                        <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }} />
                                        <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-secondary/30 p-6 rounded-lg border border-white/10">
                                <h3 className="text-lg font-semibold mb-4">Chats (Last 7 Days)</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={stats.charts.chatData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                        <XAxis dataKey="_id" stroke="#888" />
                                        <YAxis stroke="#888" />
                                        <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }} />
                                        <Bar dataKey="count" fill="#8b5cf6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "users" && (
                    <div className="bg-secondary/30 rounded-lg border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-black/50">
                                    <tr>
                                        <th className="text-left p-4">Email</th>
                                        <th className="text-left p-4">Name</th>
                                        <th className="text-left p-4">Joined</th>
                                        <th className="text-left p-4">Last Login</th>
                                        <th className="text-left p-4">Status</th>
                                        <th className="text-left p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user._id} className="border-t border-white/10">
                                            <td className="p-4">{user.email}</td>
                                            <td className="p-4">{user.name}</td>
                                            <td className="p-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                                            <td className="p-4">{new Date(user.lastLogin).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs ${user.banned ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"}`}>
                                                    {user.banned ? "Banned" : "Active"}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => toggleBan(user._id)}
                                                    className={`px-3 py-1 rounded text-sm ${user.banned ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
                                                >
                                                    {user.banned ? "Unban" : "Ban"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "chats" && (
                    <div className="bg-secondary/30 rounded-lg border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-black/50">
                                    <tr>
                                        <th className="text-left p-4">Participants</th>
                                        <th className="text-left p-4">Started</th>
                                        <th className="text-left p-4">Duration</th>
                                        <th className="text-left p-4">Messages</th>
                                        <th className="text-left p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chats.map((chat) => (
                                        <tr key={chat._id} className="border-t border-white/10">
                                            <td className="p-4">{chat.user1Name} ↔ {chat.user2Name}</td>
                                            <td className="p-4">{new Date(chat.startedAt).toLocaleString()}</td>
                                            <td className="p-4">
                                                {chat.endedAt
                                                    ? `${Math.round((new Date(chat.endedAt).getTime() - new Date(chat.startedAt).getTime()) / 60000)} min`
                                                    : "Ongoing"
                                                }
                                            </td>
                                            <td className="p-4">{chat.messages?.length || 0}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => viewChatTranscript(chat._id)}
                                                    className="px-3 py-1 rounded text-sm bg-primary hover:bg-primary/90"
                                                >
                                                    View Transcript
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Transcript Modal */}
            {selectedChat && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedChat(null)}>
                    <div className="bg-secondary max-w-2xl w-full p-6 rounded-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{selectedChat.user1Name} ↔ {selectedChat.user2Name}</h3>
                            <button onClick={() => setSelectedChat(null)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {selectedChat.messages?.map((msg: any, i: number) => (
                                <div key={i} className="bg-black/30 p-3 rounded">
                                    <p className="text-sm text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                                    <p>{msg.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
