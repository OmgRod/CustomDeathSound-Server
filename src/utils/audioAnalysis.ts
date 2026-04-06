import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execFileAsync = promisify(execFile);

export type AudioAnalysis = {
  durationSeconds: number;
  peakDbFs: number;
};

export async function analyzeAudioFile(filePath: string): Promise<AudioAnalysis> {
  const nullSink = process.platform === 'win32' ? 'NUL' : '/dev/null';

  const { stderr } = await execFileAsync(ffmpegInstaller.path, [
    '-hide_banner',
    '-i',
    filePath,
    '-af',
    'volumedetect',
    '-f',
    'null',
    nullSink,
  ], { maxBuffer: 10 * 1024 * 1024 });

  const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  const maxVolumeMatch = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);

  let durationSeconds = 0;
  if (durationMatch) {
    const hours = Number(durationMatch[1]);
    const minutes = Number(durationMatch[2]);
    const seconds = Number(durationMatch[3]);
    durationSeconds = (hours * 3600) + (minutes * 60) + seconds;
  }

  const peakDbFs = maxVolumeMatch ? Number(maxVolumeMatch[1]) : Number.NaN;

  return {
    durationSeconds,
    peakDbFs,
  };
}

export function computeAutoTags(analysis: AudioAnalysis, thresholdDbFs: number): string[] {
  const tags: string[] = [];

  if (analysis.durationSeconds > 3) {
    tags.push('long');
  }

  if (Number.isFinite(analysis.peakDbFs) && analysis.peakDbFs >= thresholdDbFs) {
    tags.push('loud');
  }

  return tags;
}

export function normalizeLengthSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return 0;
  }

  return Math.round(seconds * 1000) / 1000;
}

export async function trimLeadingTrailingSilenceInPlace(
  filePath: string,
  thresholdDb = '-35dB',
): Promise<void> {
  const directory = path.dirname(filePath);
  const extension = path.extname(filePath) || '.tmp';
  const basename = path.basename(filePath, extension);
  const tempPath = path.join(directory, `${basename}.trimmed-${Date.now()}${extension}`);

  const filter = [
    `silenceremove=start_periods=1:start_silence=0:start_threshold=${thresholdDb}`,
    'areverse',
    `silenceremove=start_periods=1:start_silence=0:start_threshold=${thresholdDb}`,
    'areverse',
  ].join(',');

  try {
    await execFileAsync(ffmpegInstaller.path, [
      '-hide_banner',
      '-y',
      '-i',
      filePath,
      '-af',
      filter,
      tempPath,
    ], { maxBuffer: 10 * 1024 * 1024 });

    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors for temporary files.
    }
    throw error;
  }
}
