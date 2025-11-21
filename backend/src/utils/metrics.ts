class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number[]> = new Map();
  private histograms: Map<string, number[]> = new Map();

  // Counter methods
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  // Timer methods - FIXED: Now accepts a name parameter
  startTimer(name: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      const timings = this.timers.get(name) || [];
      timings.push(duration);
      this.timers.set(name, timings);
    };
  }

  getTimerStats(name: string): { count: number; avg: number; min: number; max: number } {
    const timings = this.timers.get(name) || [];
    if (timings.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0 };
    }

    const sum = timings.reduce((a, b) => a + b, 0);
    const avg = sum / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);

    return { count: timings.length, avg, min, max };
  }

  // Histogram methods
  observeHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  getHistogramStats(name: string): { count: number; avg: number; p95: number; p99: number } {
    const values = this.histograms.get(name) || [];
    if (values.length === 0) {
      return { count: 0, avg: 0, p95: 0, p99: 0 };
    }

    const sorted = values.sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { count: sorted.length, avg, p95, p99 };
  }

  // Export all metrics for monitoring
  exportMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    // Export counters
    for (const [name, value] of this.counters.entries()) {
      metrics[`counter_${name}`] = value;
    }

    // Export timer stats
    for (const [name] of this.timers.entries()) {
      metrics[`timer_${name}`] = this.getTimerStats(name);
    }

    // Export histogram stats
    for (const [name] of this.histograms.entries()) {
      metrics[`histogram_${name}`] = this.getHistogramStats(name);
    }

    return metrics;
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.counters.clear();
    this.timers.clear();
    this.histograms.clear();
  }
}

// Create singleton instance
const metrics = new MetricsCollector();

export default metrics;