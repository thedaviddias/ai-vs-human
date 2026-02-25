"use client";

class SoundEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createGain(ctx: AudioContext, volume = 0.1, duration = 0.1) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    gain.connect(ctx.destination);
    return gain;
  }

  public playClick() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, 0.05, 0.05);

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  public playSuccess() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, 0.08, 0.15);

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.1);

    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  public playError() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, 0.1, 0.2);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  public playToggle(isOpen: boolean) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, 0.04, 0.1);

    osc.type = "sine";
    if (isOpen) {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
    } else {
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    }

    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }
}

export const soundEngine = typeof window !== "undefined" ? new SoundEngine() : null;
