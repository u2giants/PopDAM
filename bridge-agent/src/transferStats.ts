/**
 * Tracks bytes transferred between heartbeat intervals.
 * The bridge agent reports these stats with each heartbeat,
 * and the UI renders them as a live throughput chart.
 */

let bytesUploaded = 0;
let filesUploaded = 0;
let lastResetAt = Date.now();

/** Record bytes from a completed upload */
export function recordUpload(bytes: number) {
  bytesUploaded += bytes;
  filesUploaded += 1;
}

/** Get stats since last reset, then reset counters */
export function flushStats() {
  const now = Date.now();
  const elapsedMs = now - lastResetAt;
  const stats = {
    bytes_uploaded: bytesUploaded,
    files_uploaded: filesUploaded,
    elapsed_ms: elapsedMs,
    bytes_per_sec: elapsedMs > 0 ? Math.round((bytesUploaded / elapsedMs) * 1000) : 0,
  };
  bytesUploaded = 0;
  filesUploaded = 0;
  lastResetAt = now;
  return stats;
}
