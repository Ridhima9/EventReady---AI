import { useState, useEffect } from 'react'

export default function GoldenHourCountdown() {
 // Start at 60 minutes (3600 seconds)
 const [timeLeft, setTimeLeft] = useState(3600)

 useEffect(() => {
  const timer = setInterval(() => {
   setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
  }, 1000)
  return () => clearInterval(timer)
 }, [])

 const minutes = Math.floor(timeLeft / 60)
 const seconds = timeLeft % 60

 const formatTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

 // Thresholds:
 // > 45:00 is Green
 // 20:00 - 45:00 is Amber
 // < 20:00 is Red
 let colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
 let dotClass = 'bg-emerald-500'
 
 if (minutes <= 20) {
  colorClass = 'bg-red-50 text-red-700 border-red-200 animate-pulse'
  dotClass = 'bg-red-500'
 } else if (minutes <= 45) {
  colorClass = 'bg-amber-50 text-amber-700 border-amber-200'
  dotClass = 'bg-amber-500'
 }

 return (
  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-sm font-bold tracking-tight shadow-sm transition-colors ${colorClass}`} title="Golden Hour Countdown for Deployment">
   <div className="relative flex h-2 w-2 items-center justify-center">
    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotClass}`}></span>
    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`}></span>
   </div>
   {formatTime}
   <span className="text-[9px] uppercase tracking-wider text-slate-500 font-sans ml-1">Golden Hour</span>
  </div>
 )
}
