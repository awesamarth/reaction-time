import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Arcade stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-purple-500/20 animate-pulse"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 5 + 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl">
        <h1 className="text-6xl md:text-7xl font-bold mb-4 text-white font-(family-name:--font-doom)">
          REACTION
        </h1>
        <h1 className="text-6xl md:text-7xl font-bold mb-8 text-purple-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] font-(family-name:--font-doom)">
          TIME
        </h1>

        <p className="text-xl md:text-2xl text-white/80 mb-16 font-rajdhani font-medium">
          Test your reflexes with blockchain-backed precision
        </p>

        {/* Start button */}
        <Link
          href="/single-player"
          className="group relative px-16 py-6 bg-linear-to-r from-purple-600 to-blue-600 rounded-lg text-white font-bold text-2xl transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
        >
          <span className="relative z-10">START GAME</span>
          <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-purple-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>

        {/* Info text */}
        <p className="mt-12 text-sm text-white/50 font-rajdhani">
          Powered by RISE • 3ms Receipts
        </p>
      </div>
    </div>
  )
}
