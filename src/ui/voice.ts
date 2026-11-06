/**
 * ゼイ吉の音声。ブラウザ内蔵の読み上げ(Web Speech API)を使う。
 * あとで録音した音声に差し替えるときは、speak() の中身だけを変えればよい。
 */
const KEY = 'life-money-simulator:voice'

export const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function voiceEnabled(): boolean {
  if (!voiceSupported) return false
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setVoiceEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 保存できなくても動く */
  }
  if (!on) stopSpeaking()
}

/** 読み上げ用に整える:絵文字を消し、読み方を直す */
export function toSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/ゼイ吉/g, 'ぜいきち')
    .replace(/ワイ/g, 'わい')
    .replace(/iDeCo/g, 'イデコ')
    .replace(/e-Tax/g, 'イータックス')
    .replace(/×/g, 'かける')
    .replace(/〜/g, 'から')
    .replace(/[()()「」『』]/g, ' ')
    .trim()
}

let jaVoice: SpeechSynthesisVoice | null = null
function pickVoice(): SpeechSynthesisVoice | null {
  if (!voiceSupported) return null
  if (jaVoice) return jaVoice
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ja'))
  // 端末にあれば、より自然な声を優先する
  jaVoice =
    voices.find((v) => /Kyoko|Otoya|Google|Nanami|Keita|O-ren/i.test(v.name)) ?? voices[0] ?? null
  return jaVoice
}
if (voiceSupported) {
  window.speechSynthesis.onvoiceschanged = () => {
    jaVoice = null
    pickVoice()
  }
}

export function speak(lines: string[]): void {
  if (!voiceSupported) return
  const synth = window.speechSynthesis
  synth.cancel()
  for (const line of lines) {
    const t = toSpeech(line)
    if (!t) continue
    const u = new SpeechSynthesisUtterance(t)
    u.lang = 'ja-JP'
    u.rate = 1.1
    u.pitch = 1.35 // ちょっと高めで、妖精っぽく
    const v = pickVoice()
    if (v) u.voice = v
    synth.speak(u)
  }
}

export function stopSpeaking(): void {
  if (voiceSupported) window.speechSynthesis.cancel()
}
