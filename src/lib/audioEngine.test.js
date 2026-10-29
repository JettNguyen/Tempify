// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BufferVoice, heardTime } from './audioEngine.js'

// ─── A context that records what was scheduled ─────────────────────────────

class FakeParam {
  constructor() { this.events = [] }
  setValueAtTime(v, t) { this.events.push(['set', v, t]) }
  linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]) }
  setTargetAtTime(v, t, c) { this.events.push(['target', v, t, c]) }
  cancelScheduledValues(t) { this.events.push(['cancel', t]) }
}

class FakeNode {
  connect() {}
  disconnect() {}
}

class FakeSource extends FakeNode {
  constructor() {
    super()
    this.starts = []
    this.stops = []
    this.onended = null
  }
  start(...args) { this.starts.push(args) }
  stop(t) { this.stops.push(t) }
}

class FakeContext {
  constructor() {
    this.currentTime = 10
    this.state = 'running'
    this.destination = new FakeNode()
    this.sources = []
    this.gains = []
    this.listeners = new Set()
  }
  createBufferSource() {
    const s = new FakeSource()
    this.sources.push(s)
    return s
  }
  createGain() {
    const g = new FakeNode()
    g.gain = new FakeParam()
    this.gains.push(g)
    return g
  }
  createAnalyser() {
    return Object.assign(new FakeNode(), { frequencyBinCount: 512 })
  }
  addEventListener(type, fn) { if (type === 'statechange') this.listeners.add(fn) }
  removeEventListener(type, fn) { if (type === 'statechange') this.listeners.delete(fn) }
  resume() { return Promise.resolve() }
  setState(state) {
    this.state = state
    this.listeners.forEach((fn) => fn())
  }
}

const LEAD = 0.03
const buffer = { duration: 30 }

let ctx
let voice

beforeEach(() => {
  vi.useFakeTimers()
  ctx = new FakeContext()
  voice = new BufferVoice(buffer, ctx)
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Starting ───────────────────────────────────────────────────────────────

describe('BufferVoice.start', () => {
  it('schedules the clip a little ahead, with its stop built in', () => {
    voice.start(0, 0.5)
    const [source] = ctx.sources
    expect(source.starts).toEqual([[10 + LEAD, 0, 0.5]])
    expect(voice.playing).toBe(true)
  })

  it('fades in and out inside the clip rather than past its edges', () => {
    voice.start(0, 0.5)
    const events = ctx.gains[0].gain.events
    const at = 10 + LEAD
    expect(events[0]).toEqual(['set', 0, at])
    expect(events[1][0]).toBe('ramp')
    expect(events[1][1]).toBe(1)
    // The last event lands exactly on the stop: nothing after the half second.
    const last = events[events.length - 1]
    expect(last[0]).toBe('ramp')
    expect(last[1]).toBe(0)
    expect(last[2]).toBeCloseTo(at + 0.5, 9)
  })

  it('never runs past the end of the clip', () => {
    voice.start(29, 45)
    expect(ctx.sources[0].starts[0][2]).toBeCloseTo(1, 9)
  })

  it('crossfades out whatever was already playing', () => {
    voice.start(0, 5)
    voice.start(2, 5)
    const [first, second] = ctx.sources
    expect(first.stops.length).toBe(1)
    expect(first.onended).toBeNull()
    expect(second.starts[0][1]).toBe(2)
  })
})

// ─── Where the playhead is ──────────────────────────────────────────────────

describe('BufferVoice.position', () => {
  it('holds the start until the scheduled moment arrives', () => {
    voice.start(1, 5)
    expect(voice.position()).toBe(1)
  })

  it('moves with the clock and stops at the cutoff', () => {
    voice.start(0, 2)
    ctx.currentTime = 10 + LEAD + 1.25
    expect(voice.position()).toBeCloseTo(1.25, 9)
    ctx.currentTime = 10 + LEAD + 9
    expect(voice.position()).toBe(2)
  })

  it('reads the speaker, not the render clock, when the output stamp is sane', () => {
    vi.spyOn(performance, 'now').mockReturnValue(5000)
    ctx.currentTime = 20.3
    // The speaker is playing context time 20.1 right now: 200ms of latency.
    ctx.getOutputTimestamp = () => ({ contextTime: 20.1, performanceTime: 5000 })
    expect(heardTime(ctx)).toBeCloseTo(20.1, 9)
  })

  it('ignores an output stamp that has run off', () => {
    vi.spyOn(performance, 'now').mockReturnValue(5000)
    ctx.currentTime = 20
    ctx.getOutputTimestamp = () => ({ contextTime: 3, performanceTime: 5000 })
    expect(heardTime(ctx)).toBe(20)
  })
})

// ─── Pausing ────────────────────────────────────────────────────────────────

describe('BufferVoice.pause', () => {
  it('remembers where it was and fades out', () => {
    voice.start(0, 5)
    ctx.currentTime = 10 + LEAD + 1.5
    voice.pause()
    expect(voice.playing).toBe(false)
    expect(voice.position()).toBeCloseTo(1.5, 9)
    const events = ctx.gains[0].gain.events
    expect(events.some(([kind, value]) => kind === 'target' && value === 0)).toBe(true)
    expect(ctx.sources[0].stops[0]).toBeGreaterThan(ctx.currentTime)
  })
})

// ─── Unlocking more while it plays ──────────────────────────────────────────

describe('BufferVoice.extend', () => {
  it('hands over to a longer clip at the exact sample the first was on', () => {
    voice.start(0, 1)
    ctx.currentTime = 10 + LEAD + 0.4
    voice.extend(2)
    const [first, second] = ctx.sources
    const at = ctx.currentTime + LEAD
    expect(first.stops).toEqual([at])
    const [when, offset, length] = second.starts[0]
    expect(when).toBe(at)
    // 0.4s in, plus the lead, is where the first source would be at `at`.
    expect(offset).toBeCloseTo(0.4 + LEAD, 9)
    expect(offset + length).toBeCloseTo(2, 9)
    // No fade-in on the hand-over: the sound is continuous.
    expect(ctx.gains[1].gain.events[0]).toEqual(['set', 1, at])
  })

  it('leaves a clip alone once its fade-out has begun', () => {
    voice.start(0, 1)
    ctx.currentTime = 10 + LEAD + 0.99
    voice.extend(2)
    expect(ctx.sources.length).toBe(1)
  })

  it('only ever grows', () => {
    voice.start(0, 2)
    voice.extend(1)
    expect(ctx.sources.length).toBe(1)
  })
})

// ─── Reaching the end ───────────────────────────────────────────────────────

describe('BufferVoice end', () => {
  it('reports the end once the clip has finished', () => {
    const onEnd = vi.fn()
    voice.onEnd = onEnd
    voice.start(0, 0.5)
    ctx.currentTime = 10 + LEAD + 0.5
    ctx.sources[0].onended()
    vi.runAllTimers()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(voice.playing).toBe(false)
  })

  it('says nothing for a source that was replaced', () => {
    const onEnd = vi.fn()
    voice.onEnd = onEnd
    voice.start(0, 0.5)
    const stale = ctx.sources[0]
    voice.start(0, 0.5)
    stale.onended?.()
    vi.runAllTimers()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('stops and says so when the system takes the context away', () => {
    const onInterrupt = vi.fn()
    voice.onInterrupt = onInterrupt
    voice.start(0, 5)
    ctx.setState('interrupted')
    expect(onInterrupt).toHaveBeenCalledTimes(1)
    expect(voice.playing).toBe(false)
  })
})

// ─── Waiting on the context ─────────────────────────────────────────────────

describe('BufferVoice.play', () => {
  it('starts once a sleeping context wakes', async () => {
    ctx.state = 'suspended'
    const result = voice.play(0, 1)
    ctx.setState('running')
    await expect(result).resolves.toBe(true)
    expect(ctx.sources.length).toBe(1)
  })

  it('gives up rather than starting on some later, unrelated tap', async () => {
    ctx.state = 'suspended'
    const result = voice.play(0, 1)
    vi.advanceTimersByTime(900)
    await expect(result).resolves.toBe(false)
    ctx.setState('running')
    expect(ctx.sources.length).toBe(0)
  })

  it('stays quiet if paused while it was waiting', async () => {
    ctx.state = 'suspended'
    const result = voice.play(0, 1)
    voice.pause()
    ctx.setState('running')
    await expect(result).resolves.toBe(false)
    expect(ctx.sources.length).toBe(0)
  })
})
