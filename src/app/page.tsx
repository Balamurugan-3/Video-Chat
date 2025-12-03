import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          RandomChat
        </h1>
        <Link
          href="/login"
          className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors font-medium"
        >
          Login
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-4xl space-y-8">
          <h2 className="text-6xl md:text-8xl font-black tracking-tighter">
            Meet <span className="text-primary">Strangers</span><br />
            Make <span className="text-accent">Friends</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Experience the thrill of random video connections.
            Safe, secure, and instant matching with people from around the world.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link
              href="/chat"
              className="px-12 py-4 rounded-full bg-primary hover:bg-primary/90 text-white text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-primary/25"
            >
              Start Chatting Now
            </Link>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-gray-600">
        <p>&copy; 2024 RandomChat. All rights reserved.</p>
      </footer>
    </div>
  );
}
