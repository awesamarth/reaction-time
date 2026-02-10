'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { riseTestnet } from 'viem/chains'

enum GameState {
  IDLE = 'idle',
  WAITING = 'waiting',
  READY = 'ready',
  CLICKED = 'clicked',
  FINISHED = 'finished',
  TOO_EARLY = 'too_early',
}

interface Result {
  attempt: number
  reactionTime: number
  txTime: number
  totalTime: number
  failed?: boolean
}

// Create burner wallet
const account = privateKeyToAccount(process.env.NEXT_PUBLIC_BURNER_KEY as `0x${string}`)
const client = createWalletClient({
  account,
  chain: riseTestnet,
  transport: http()
})

const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http()
})

// Pre-signed transaction pool for optimal performance
// Transactions are signed ahead of time to minimize RPC calls during gameplay
let preSignedPool: {
  transactions: `0x${string}`[]
  currentIndex: number
  baseNonce: number
  hasTriggeredRefill: boolean
} = {
  transactions: [],
  currentIndex: 0,
  baseNonce: 0,
  hasTriggeredRefill: false
}

// Gas parameters fetched once on initialization
let gasPrice: bigint = 0n
let gasLimit: bigint = 21000n

// Accounts for browser rendering delays
const ADJUSTMENT = 100

export default function SinglePlayer() {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE)
  const [currentRound, setCurrentRound] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [isReady, setIsReady] = useState(false)

  const greenTimeRef = useRef(0)
  const clickTimeRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Initialize transaction pool on component mount
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch nonce and gas price once to use for all transactions
        const [nonce, gas] = await Promise.all([
          publicClient.getTransactionCount({ address: account.address }),
          publicClient.getGasPrice()
        ])

        gasPrice = gas
        preSignedPool.baseNonce = nonce

        // Estimate gas required for transactions with data payload
        const estimatedGas = await publicClient.estimateGas({
          account: account.address,
          to: account.address,
          value: 0n,
          data: '0x01' as `0x${string}`
        })
        gasLimit = estimatedGas

        console.log(`Gas estimated: ${gasLimit}`)

        // Pre-sign initial batch of 10 transactions
        await preSignBatch(nonce, 10)
        setIsReady(true)
      } catch (error) {
        console.error('Failed to initialize:', error)
      }
    }
    init()
  }, [])

  // Sign transactions in advance to avoid RPC calls during gameplay
  const preSignBatch = async (startNonce: number, batchSize: number) => {
    const signingPromises = Array.from({ length: batchSize }, async (_, i) => {
      const txData = {
        to: account.address, // Send to self
        value: 0n,
        data: `0x${(i + 1).toString(16).padStart(2, '0')}` as `0x${string}`,
        nonce: startNonce + i,
        gasPrice: gasPrice,
        gas: gasLimit,
        type: 'legacy' as const
      }

      return await client.signTransaction(txData)
    })

    const newTransactions = await Promise.all(signingPromises)
    preSignedPool.transactions.push(...newTransactions)

    console.log(`Pre-signed ${batchSize} transactions. Pool size: ${preSignedPool.transactions.length}`)
  }

  // Retrieve next transaction from pool and trigger background refill at 50% capacity
  const getNextTransaction = (): `0x${string}` => {
    const pool = preSignedPool
    if (pool.currentIndex >= pool.transactions.length) {
      throw new Error('No pre-signed transactions available')
    }

    const tx = pool.transactions[pool.currentIndex]
    pool.currentIndex++

    // Trigger background refill when pool is half empty
    if (pool.currentIndex % 5 === 0 && !pool.hasTriggeredRefill) {
      console.log(`Refilling at ${pool.currentIndex} transactions used`)
      pool.hasTriggeredRefill = true
      const nextNonce = pool.baseNonce + pool.transactions.length
      // Non-blocking refill in background
      preSignBatch(nextNonce, 10).then(() => {
        pool.hasTriggeredRefill = false
      })
    }

    return tx
  }

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }

  const startRound = useCallback(() => {
    setGameState(GameState.WAITING)
    clearTimers()

    // Random delay 1-5 seconds
    const delay = 1000 + Math.random() * 4000
    const startTime = performance.now()

    const checkTime = (now: number) => {
      if (now - startTime >= delay) {
        setGameState(GameState.READY)
        greenTimeRef.current = now
      } else {
        animFrameRef.current = requestAnimationFrame(checkTime)
      }
    }
    animFrameRef.current = requestAnimationFrame(checkTime)
  }, [])

  const handleClick = useCallback(async () => {
    if (!isReady) return
    const now = performance.now()

    if (gameState === GameState.IDLE || gameState === GameState.FINISHED || gameState === GameState.TOO_EARLY) {
      // Start new game
      setCurrentRound(1)
      setResults([])
      startRound()
    } else if (gameState === GameState.WAITING) {
      // Clicked too early!
      clearTimers()
      setGameState(GameState.TOO_EARLY)
      setCurrentRound(0)
      setResults([])
    } else if (gameState === GameState.READY) {
      // Valid click!
      clickTimeRef.current = now
      const reactionTime = Math.round(now - greenTimeRef.current) - ADJUSTMENT
      setGameState(GameState.CLICKED)

      try {
        // Measure transaction time from retrieval to confirmation
        const txStart = performance.now()
        const signedTx = getNextTransaction()

        // Send pre-signed transaction with synchronous confirmation
        await client.request({
          method: 'eth_sendRawTransactionSync',
          params: [signedTx]
        })

        const txTime = Math.round(performance.now() - txStart)

        // Alternative: Use sendTransactionSync for simpler usage (makes multiple RPC calls)
        // const txTime = await client.sendTransactionSync({
        //   to: account.address,
        //   value: 0n,
        //   data: `0x${currentRound.toString(16).padStart(2, '0')}` as `0x${string}`
        // })

        const result: Result = {
          attempt: currentRound,
          reactionTime,
          txTime,
          totalTime: reactionTime + txTime,
          failed: false
        }
        setResults(prev => [...prev, result])

        // Check if game complete
        if (currentRound >= 5) {
          setGameState(GameState.FINISHED)
        } else {
          setCurrentRound(prev => prev + 1)
          startRound()
        }
      } catch (error) {
        console.error('Transaction failed:', error)
        // Record failed attempt
        const result: Result = {
          attempt: currentRound,
          reactionTime,
          txTime: 0,
          totalTime: reactionTime,
          failed: true
        }
        setResults(prev => [...prev, result])

        if (currentRound >= 5) {
          setGameState(GameState.FINISHED)
        } else {
          setCurrentRound(prev => prev + 1)
          startRound()
        }
      }
    }
  }, [gameState, currentRound, startRound, isReady])

  const getBackgroundColor = () => {
    switch (gameState) {
      case GameState.IDLE: return 'bg-purple-600'
      case GameState.WAITING: return 'bg-red-600'
      case GameState.READY: return 'bg-green-500'
      case GameState.CLICKED: return 'bg-green-500'
      case GameState.FINISHED: return 'bg-blue-600'
      case GameState.TOO_EARLY: return 'bg-red-800'
      default: return 'bg-purple-600'
    }
  }

  const getMessage = () => {
    if (!isReady) return 'INITIALIZING...'
    switch (gameState) {
      case GameState.IDLE: return 'CLICK TO START'
      case GameState.WAITING: return 'WAIT...'
      case GameState.READY: return 'CLICK NOW!'
      case GameState.CLICKED: return 'RECORDING...'
      case GameState.FINISHED: return 'GAME COMPLETE!'
      case GameState.TOO_EARLY: return 'TOO EARLY! CLICK TO RETRY'
      default: return 'CLICK TO START'
    }
  }

  const successfulResults = results.filter(r => !r.failed)
  const avgReaction = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.reactionTime, 0) / results.length)
    : 0
  const avgTx = successfulResults.length > 0
    ? Math.round(successfulResults.reduce((sum, r) => sum + r.txTime, 0) / successfulResults.length)
    : 0
  const avgTotal = avgReaction + avgTx

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Back button */}
      <Link
        href="/"
        className="fixed top-8 left-8 flex items-center gap-2 text-white/70 hover:text-white transition-colors font-rajdhani z-50"
      >
        <ArrowLeft size={20} />
        <span>BACK</span>
      </Link>

      {/* Title */}
      <div className="text-center mb-8 pt-24">
        <p className="text-white/60 font-rajdhani text-lg">
          {gameState === GameState.IDLE || gameState === GameState.TOO_EARLY
            ? 'Click when the box turns green'
            : `Round ${currentRound} of 5`}
        </p>
      </div>

      {/* Game canvas */}
      <div className="max-w-4xl mx-auto">
        <div
          onClick={handleClick}
          className={`w-full aspect-video rounded-lg flex flex-col items-center justify-center cursor-pointer select-none ${getBackgroundColor()}`}
        >
          <h2 className="text-3xl md:text-4xl font-bold font-rajdhani text-white mb-2">
            {getMessage()}
          </h2>
          {gameState === GameState.CLICKED && (
            <div className="text-lg text-white/70 font-rajdhani">
              Processing transaction...
            </div>
          )}
        </div>

        {/* Results */}
        {gameState === GameState.FINISHED && (
          <div className="mt-8 p-8 bg-gray-900 rounded-lg border border-purple-500/30">
            <h3 className="text-2xl font-bold font-(family-name:--font-doom) mb-6 text-center text-purple-500">
              RESULTS
            </h3>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-black p-4 rounded-lg text-center border border-green-500/20">
                <div className="text-sm text-white/60 font-rajdhani mb-1">AVG REACTION</div>
                <div className="text-3xl font-bold text-green-500">{avgReaction}ms</div>
              </div>
              <div className="bg-black p-4 rounded-lg text-center border border-blue-500/20">
                <div className="text-sm text-white/60 font-rajdhani mb-1">RISE TX TIME</div>
                <div className="text-3xl font-bold text-blue-500">{avgTx}ms</div>
              </div>
              <div className="bg-black p-4 rounded-lg text-center border border-purple-500/20">
                <div className="text-sm text-white/60 font-rajdhani mb-1">AVG TOTAL</div>
                <div className="text-3xl font-bold text-purple-500">{avgTotal}ms</div>
              </div>
            </div>

            {/* RISE highlight */}
            <div className="bg-linear-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4 mb-8">
              <div className="text-center">
                <p className="text-lg font-rajdhani font-semibold text-purple-400 mb-1">
                  RISE adds only ~{avgTx}ms overhead
                </p>
                <p className="text-sm text-white/60 font-rajdhani">
                  That's {Math.round((avgTx / avgReaction) * 100)}% of your reaction time • Fastest confirmations in Web3
                </p>
              </div>
            </div>

            {/* Individual rounds */}
            <div className="overflow-x-auto">
              <table className="w-full font-rajdhani">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-white/60">ROUND</th>
                    <th className="text-right py-3 px-2 text-white/60">REACTION</th>
                    <th className="text-right py-3 px-2 text-white/60">TX TIME</th>
                    <th className="text-right py-3 px-2 text-white/60">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.attempt} className="border-b border-white/5">
                      <td className="py-3 px-2">{result.attempt}</td>
                      <td className="text-right py-3 px-2 text-green-500">{result.reactionTime}ms</td>
                      <td className="text-right py-3 px-2">
                        {result.failed ? (
                          <span className="text-red-500">FAILED</span>
                        ) : (
                          <span className="text-blue-500">{result.txTime}ms</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-2 font-bold">
                        {result.failed ? (
                          <span className="text-red-500">—</span>
                        ) : (
                          `${result.totalTime}ms`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Play again */}
            <button
              onClick={handleClick}
              className="w-full mt-8 py-4 bg-linear-to-r from-purple-600 to-blue-600 rounded-lg font-bold text-xl hover:scale-105 transition-transform"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-8 text-center text-sm text-white/40 font-rajdhani">
          <p>Each click sends a real transaction to RISE Testnet</p>
          <p className="mt-1">Powered by synchronous transactions • 3ms confirmations</p>
        </div>
      </div>
    </div>
  )
}
