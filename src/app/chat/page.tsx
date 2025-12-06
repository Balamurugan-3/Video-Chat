"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { socket } from "@/lib/socket";
import type Peer from "peerjs";
import { useRouter } from "next/navigation";
import { AdBanner } from "@/components/ads/AdBanner";

export default function ChatPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [searching, setSearching] = useState(false);
    const [connected, setConnected] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [peerReady, setPeerReady] = useState(false);

    // User Profile State
    const [name, setName] = useState("");
    const [gender, setGender] = useState("Male");
    const [age, setAge] = useState("18");
    const [country, setCountry] = useState("Global");
    const [showProfileInput, setShowProfileInput] = useState(true);

    // Remote Profile State
    const [remoteProfile, setRemoteProfile] = useState<{ name: string; gender: string; age: string } | null>(null);

    // Chat State
    const [messages, setMessages] = useState<{ text: string; isMe: boolean }[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Ad State
    const [showAd, setShowAd] = useState(false);
    const [adTimer, setAdTimer] = useState(5);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const currentCallRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (session?.user?.name) {
            setName(session.user.name);
        }
    }, [session]);

    useEffect(() => {
        if (session === null) {
            router.push("/login");
        }
    }, [session, router]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showAd && adTimer > 0) {
            interval = setInterval(() => {
                setAdTimer((prev) => prev - 1);
            }, 1000);
        } else if (showAd && adTimer === 0) {
            // Ad finished, start matching
            setShowAd(false);

            // Validate peer is ready before matching
            if (!peerRef.current?.id) {
                console.error("❌ Peer ID not ready, cannot start matching");
                setErrorMessage("Connection not ready. Please try again.");
                setPermissionDenied(true);
                return;
            }

            setSearching(true);
            setMessages([]);
            console.log("🔍 Starting match with peer ID:", peerRef.current.id);
            socket.emit("find_match", {
                peerId: peerRef.current.id,
                country,
                name,
                gender,
                age
            });
        }
        return () => clearInterval(interval);
    }, [showAd, adTimer, country, name, gender, age]);

    const initializeMedia = async () => {
        try {
            // More permissive constraints to avoid timeout
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            };

            // Add timeout to prevent hanging
            const mediaPromise = navigator.mediaDevices.getUserMedia(constraints);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Camera access timeout")), 10000)
            );

            const stream = await Promise.race([mediaPromise, timeoutPromise]) as MediaStream;

            setLocalStream(stream);
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setPermissionDenied(false);
            console.log("✓ Camera and microphone initialized successfully");
            return true;
        } catch (err: any) {
            console.error("Failed to get media:", err);

            // Provide specific error messages
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                console.error("Camera permission denied by user");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                console.error("No camera/microphone found");
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                console.error("Camera is already in use by another application");
            } else if (err.message === "Camera access timeout") {
                console.error("Camera access timed out - please check your device");
            }

            setPermissionDenied(true);
            return false;
        }
    };

    useEffect(() => {
        // initializeMedia(); // Removed auto-initialization

        // Initialize PeerJS first
        import("peerjs").then(({ default: Peer }) => {
            const peer = new Peer();
            peerRef.current = peer;

            peer.on("open", (id) => {
                console.log("✓ My peer ID is: " + id);
                setPeerReady(true);

                // Connect socket AFTER peer is ready
                socket.connect();
                console.log("✓ Socket connected");

                // Register socket event listeners AFTER connection
                socket.on("match_found", ({ remotePeerId, remoteName, remoteGender, remoteAge, initiator }: any) => {
                    console.log("🎉 Match found!", { remotePeerId, remoteName, remoteGender, remoteAge, initiator });

                    // Set profile data
                    if (remoteName && remoteGender && remoteAge) {
                        setRemoteProfile({
                            name: remoteName,
                            gender: remoteGender,
                            age: remoteAge
                        });
                        console.log("✓ Remote profile set:", remoteName, remoteGender, remoteAge);
                    } else {
                        console.warn("⚠ Incomplete profile data received:", { remoteName, remoteGender, remoteAge });
                        setRemoteProfile({
                            name: remoteName || "Anonymous",
                            gender: remoteGender || "Unknown",
                            age: remoteAge || "?"
                        });
                    }

                    if (initiator && localStreamRef.current) {
                        console.log("📞 Initiating call to:", remotePeerId);
                        const call = peerRef.current?.call(remotePeerId, localStreamRef.current);
                        if (call) {
                            call.on("stream", (remoteStream) => {
                                console.log("✓ Received remote stream (outgoing call)");
                                setRemoteStream(remoteStream);
                                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                            });
                            currentCallRef.current = call;
                        }
                        setConnected(true);
                        setSearching(false);
                        setCallEnded(false);
                    } else if (!initiator) {
                        console.log("⏳ Waiting for incoming call from:", remotePeerId);
                        setConnected(true);
                        setSearching(false);
                        setCallEnded(false);
                    }
                });

                socket.on("receive_message", ({ message }: any) => {
                    console.log("💬 Message received:", message);
                    setMessages(prev => [...prev, { text: message, isMe: false }]);
                });

                socket.on("peer_disconnected", () => {
                    console.log("⚠ Peer disconnected");
                    handleEndCall();
                });

                socket.on("call_ended", () => {
                    console.log("📞 Call ended by remote peer");
                    if (currentCallRef.current) currentCallRef.current.close();
                    setConnected(false);
                    setCallEnded(true);
                    setRemoteStream(null);
                    setRemoteProfile(null);
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
                });

                socket.on("error", ({ message }: any) => {
                    console.error("❌ Server error:", message);
                    setErrorMessage(message);
                    setSearching(false);
                    setPermissionDenied(true);
                });

                console.log("✓ Socket event listeners registered");
            });

            peer.on("call", (call) => {
                if (localStreamRef.current) {
                    console.log("📞 Answering incoming call");
                    call.answer(localStreamRef.current);
                    call.on("stream", (remoteStream) => {
                        console.log("✓ Received remote stream (incoming call)");
                        setRemoteStream(remoteStream);
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                    });
                    currentCallRef.current = call;
                    setConnected(true);
                    setSearching(false);
                    setCallEnded(false);
                }
            });

            peer.on("error", (err) => {
                console.error("❌ PeerJS error:", err);
                setErrorMessage("Connection error. Please refresh and try again.");
            });
        });

        return () => {
            peerRef.current?.destroy();
            localStreamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const handleStartClick = async () => {
        if (!name.trim()) {
            alert("Please enter your name");
            return;
        }
        if (!age || parseInt(age) < 18) {
            alert("You must be 18+ to use this app");
            return;
        }

        // Check if peer is ready
        if (!peerReady || !peerRef.current?.id) {
            setErrorMessage("Connection is initializing. Please wait a moment and try again.");
            setPermissionDenied(true);
            return;
        }

        if (!localStream) {
            const success = await initializeMedia();
            if (!success) return;
        }

        setShowProfileInput(false);
        setCallEnded(false);
        setPermissionDenied(false);
        setErrorMessage("");
        // Show Ad before starting
        setAdTimer(5);
        setShowAd(true);
    };

    const handleEndCall = () => {
        if (currentCallRef.current) currentCallRef.current.close();
        socket.emit("end_call");
        setConnected(false);
        setCallEnded(true);
        setRemoteStream(null);
        setRemoteProfile(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const handleNext = () => {
        setCallEnded(false);
        setMessages([]);
        // Show Ad again before next match
        setAdTimer(5);
        setShowAd(true);
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        socket.emit("send_message", { message: newMessage });
        setMessages(prev => [...prev, { text: newMessage, isMe: true }]);
        setNewMessage("");
    };

    return (
        <div className="flex h-screen flex-col bg-black overflow-hidden">
            <div className="flex-1 relative h-full">
                {/* Remote Video */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                />

                {/* Remote Profile Badge */}
                {connected && remoteProfile && (
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 z-20 min-w-[200px]">
                        <h3 className="text-white font-bold text-lg">{remoteProfile.name}</h3>
                        <div className="flex gap-3 text-sm text-gray-300 mt-1">
                            <span>{remoteProfile.gender}</span>
                            <span>•</span>
                            <span>{remoteProfile.age} y/o</span>
                        </div>
                    </div>
                )}

                {/* Ad Overlay */}
                {showAd && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
                        <div className="text-center p-8 bg-zinc-900 rounded-2xl border border-white/10 max-w-md w-full mx-4">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">Advertisement</h2>
                                <p className="text-gray-400">Please watch this ad to continue</p>
                            </div>

                            <div className="w-full h-48 bg-zinc-800 rounded-xl mb-6 flex items-center justify-center border border-white/5">
                                <span className="text-zinc-500 font-medium">Ad Content Placeholder</span>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <div className="text-4xl font-bold text-primary">{adTimer}</div>
                                <p className="text-sm text-gray-500">seconds remaining</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Overlay (Search/Profile/Ended) */}
                {!connected && !showAd && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 z-10 overflow-y-auto">
                        {searching ? (
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-white text-xl font-medium">Looking for someone...</p>
                            </div>
                        ) : callEnded ? (
                            <div className="text-center">
                                <h2 className="text-white text-2xl font-bold mb-6">Call Ended</h2>
                                <button
                                    onClick={handleNext}
                                    className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-primary/25 cursor-pointer"
                                >
                                    Find New Match
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6 w-full max-w-md px-4 py-8">
                                {permissionDenied ? (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 w-full text-center max-w-md">
                                        <h3 className="text-red-500 text-lg font-bold mb-3">
                                            {errorMessage.includes("Camera") ? "Camera Access Required" : "Connection Error"}
                                        </h3>
                                        <p className="text-gray-300 text-sm mb-4">
                                            {errorMessage || "Please allow camera and microphone access to continue."}
                                        </p>
                                        <button
                                            onClick={() => {
                                                setPermissionDenied(false);
                                                setErrorMessage("");
                                                initializeMedia();
                                            }}
                                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-full space-y-4">
                                            <div>
                                                <label className="text-gray-400 text-sm mb-2 block">Your Name</label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="Enter your name"
                                                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-colors"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-gray-400 text-sm mb-2 block">Gender</label>
                                                    <select
                                                        value={gender}
                                                        onChange={(e) => setGender(e.target.value)}
                                                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-colors"
                                                    >
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-gray-400 text-sm mb-2 block">Age</label>
                                                    <input
                                                        type="number"
                                                        value={age}
                                                        onChange={(e) => setAge(e.target.value)}
                                                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-gray-400 text-sm mb-2 block">Region</label>
                                                <select
                                                    value={country}
                                                    onChange={(e) => setCountry(e.target.value)}
                                                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-primary transition-colors"
                                                >
                                                    <option value="Global">Global</option>
                                                    <option value="US">United States</option>
                                                    <option value="IN">India</option>
                                                    <option value="UK">United Kingdom</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleStartClick}
                                            disabled={!peerReady}
                                            className="w-full bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-primary/25 cursor-pointer mt-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {!peerReady ? "Connecting..." : localStream ? "Start Chatting" : "Enable Camera & Start"}
                                        </button>
                                        {!peerReady && (
                                            <p className="text-gray-400 text-xs mt-2">Initializing connection...</p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Chat Overlay */}
                {connected && (
                    <div className="absolute bottom-24 left-4 w-80 h-64 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col overflow-hidden z-20">
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${msg.isMe ? 'bg-primary text-white' : 'bg-zinc-800 text-gray-200'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="p-2 bg-black/20 border-t border-white/5 flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="w-full bg-transparent text-white text-sm px-3 py-2 outline-none placeholder-gray-500 pr-8"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    onClick={() => {
                                        // Simple emoji picker toggle or implementation
                                        // For now, let's just add a few common emojis directly
                                        const emojis = ["😊", "😂", "❤️", "👍", "👋"];
                                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                                        setNewMessage(prev => prev + randomEmoji);
                                    }}
                                >
                                    😊
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-primary text-white p-2 rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                </svg>
                            </button>
                        </form>
                    </div>
                )}

                {/* Local Video */}
                <div className="absolute bottom-4 right-4 w-48 h-36 bg-black rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl z-20">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover mirror"
                    />
                </div>
            </div>

            {/* Controls */}
            {connected && (
                <div className="h-24 bg-zinc-900/80 backdrop-blur-md flex items-center justify-center gap-4 border-t border-white/5 absolute bottom-0 w-full z-30">
                    <button
                        onClick={handleEndCall}
                        className="bg-red-500 text-white px-8 py-3 rounded-full font-bold hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
                    >
                        End Call
                    </button>
                </div>
            )}

            {/* Ad Banner */}
            {/* <div className="absolute top-4 left-4 z-20 hidden md:block">
                <AdBanner className="w-64 bg-black/50 backdrop-blur-md" />
            </div> */}

            <style jsx global>{`
        .mirror {
            transform: scaleX(-1);
        }
      `}</style>
        </div>
    );
}
