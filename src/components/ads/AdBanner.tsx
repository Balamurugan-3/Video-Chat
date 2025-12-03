export function AdBanner({ className }: { className?: string }) {
    return (
        <div className={`bg-zinc-800/50 border border-white/5 rounded-lg p-4 flex items-center justify-center text-zinc-500 text-sm ${className}`}>
            <span className="font-mono">A</span>
        </div>
    );
}
