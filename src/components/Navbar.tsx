'use client'

import { useState, useEffect } from 'react'
import { createPublicClient, http, formatEther } from 'viem'
import { riseTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { Copy, Check } from 'lucide-react'

const account = privateKeyToAccount(process.env.NEXT_PUBLIC_BURNER_KEY as `0x${string}`)
const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http()
})

export default function Navbar() {
  const [balance, setBalance] = useState<string>('0')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const bal = await publicClient.getBalance({ address: account.address })
        setBalance(formatEther(bal))
      } catch (error) {
        console.error('Failed to fetch balance:', error)
      }
    }

    fetchBalance()
    const interval = setInterval(fetchBalance, 10000) // Refresh every 10s

    return () => clearInterval(interval)
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(account.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold font-[family-name:var(--font-doom)] text-purple-500">
            REACTION TIME
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Balance */}
          <div className="bg-gray-900 rounded-lg px-4 py-2 border border-purple-500/20">
            <div className="text-xs text-white/50 font-rajdhani mb-0.5">BALANCE</div>
            <div className="text-sm font-bold font-rajdhani text-green-500">
              {parseFloat(balance).toFixed(4)} ETH
            </div>
          </div>

          {/* Address with copy */}
          <div className="bg-gray-900 rounded-lg px-4 py-2 border border-purple-500/20 flex items-center gap-2">
            <div>
              <div className="text-xs text-white/50 font-rajdhani mb-0.5">ADDRESS</div>
              <div className="text-sm font-mono text-white">
                {shortenAddress(account.address)}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Copy size={16} className="text-white/60" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
