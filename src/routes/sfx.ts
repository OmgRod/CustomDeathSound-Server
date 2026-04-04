import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import rateLimiter from '../utils/rateLimiter';

const router = express.Router();
const execFileAsync = promisify(execFile);

async function analyzeAudioFile(filePath: string) {
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

function parseSearchParams(req: Request) {
    const query = String(req.query.query ?? '').trim().toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    return { query, limit };
}

router.get('/search', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const { query, limit } = parseSearchParams(req);

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    const filtered = !query
        ? sfxList
        : sfxList.filter((item) => {
            const id = String(item.id).toLowerCase();
            const name = String(item.name).toLowerCase();
            return id.includes(query) || name.includes(query);
        });

    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    return res.status(200).json({ data: sorted });
}));

router.post(
    '/admin/macros/delete-missing-files',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        await sfxDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const soundsDir = path.join(__dirname, '../../public/sounds');

        const removedIds: string[] = [];
        const kept: typeof sfxList = [];

        for (const item of sfxList) {
            const filePath = path.join(soundsDir, path.basename(item.url));
            try {
                await fs.access(filePath);
                kept.push(item);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    removedIds.push(item.id);
                    continue;
                }
                throw error;
            }
        }

        if (sfxDB.data) {
            sfxDB.data.sfx = kept;
            await sfxDB.write();
        }

        return res.status(200).json({
            message: 'Missing-file cleanup completed.',
            removedCount: removedIds.length,
            removedIds,
            remainingCount: kept.length,
        });
    })
);

router.post(
    '/admin/macros/auto-assign-tags',
    rateLimiter(10, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        await sfxDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const soundsDir = path.join(__dirname, '../../public/sounds');

        const thresholdDbFs = 0;
        let updatedCount = 0;
        let removedTagsCount = 0;
        let longCount = 0;
        let loudCount = 0;
        const failed: Array<{ id: string; reason: string }> = [];

        for (const item of sfxList) {
            const filePath = path.join(soundsDir, path.basename(item.url));

            try {
                await fs.access(filePath);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    failed.push({ id: item.id, reason: 'file-missing' });
                    continue;
                }
                throw error;
            }

            try {
                const analysis = await analyzeAudioFile(filePath);
                const nextTags: string[] = [];

                if (analysis.durationSeconds > 3) {
                    nextTags.push('long');
                }

                if (Number.isFinite(analysis.peakDbFs) && analysis.peakDbFs >= thresholdDbFs) {
                    nextTags.push('loud');
                }

                if (nextTags.includes('long')) {
                    longCount += 1;
                }
                if (nextTags.includes('loud')) {
                    loudCount += 1;
                }

                const currentTags = Array.isArray(item.tags) ? item.tags : [];
                const normalizedCurrent = [...new Set(currentTags)].sort();
                const normalizedNext = [...new Set(nextTags)].sort();
                if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedNext)) {
                    item.tags = normalizedNext;
                    removedTagsCount += normalizedCurrent.filter((tag) => !normalizedNext.includes(tag)).length;
                    updatedCount += 1;
                }
            } catch (error) {
                failed.push({ id: item.id, reason: error instanceof Error ? error.message : 'analyze-failed' });
            }
        }

        await sfxDB.write();

        return res.status(200).json({
            message: 'Auto-tag macro completed.',
            thresholdDbFs,
            updatedCount,
            removedTagsCount,
            longCount,
            loudCount,
            failedCount: failed.length,
            failed,
            note: 'The macro replaces the full tags array with the computed tags for each sound.',
        });
    })
);

router.get('/', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const { query, limit } = parseSearchParams(req);

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    const filtered = !query
        ? sfxList
        : sfxList.filter((item) => {
            const id = String(item.id).toLowerCase();
            const name = String(item.name).toLowerCase();
            return id.includes(query) || name.includes(query);
        });

    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    return res.status(200).json({ data: sorted });
}));

router.get('/:sfxID', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const { sfxID } = req.params;

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    const sfx = sfxList.find(item => String(item.id) === sfxID);

    if (!sfx) {
        return res.status(404).json({ error: 'SFX not found' });
    }

    res.status(200).json({ sfx });
}));

router.get('/:sfxID/download', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.sfxID;
    await sfxDB.read();
        const sfxList = sfxDB.data?.sfx ?? [];
        const index = sfxList.findIndex((item) => item.id === id);

        if (index === -1) {
                return res.status(404).json({ error: 'SFX not found.' });
        }

        const current = sfxList[index];
        const nextDownloads = Number.isFinite(current.downloads) ? current.downloads + 1 : 1;
        sfxList[index] = { ...current, downloads: nextDownloads };
        await sfxDB.write();

        return res.status(200).json({ sfx: sfxList[index] });
}));

router.get(
    '/:sfxID/file-status',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;

        await sfxDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const sfx = sfxList.find(item => String(item.id) === sfxID);

        if (!sfx) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const soundsDir = path.join(__dirname, '../../public/sounds');
        const filename = path.basename(sfx.url);
        const filePath = path.join(soundsDir, filename);

        try {
            await fs.access(filePath);
            return res.status(200).json({
                sfxId: sfx.id,
                filename,
                exists: true,
            });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return res.status(200).json({
                    sfxId: sfx.id,
                    filename,
                    exists: false,
                });
            }

            throw error;
        }
    })
);

router.delete(
    '/:sfxID',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;

        await sfxDB.read();
        if (!sfxDB.data?.sfx?.length) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const sfxIndex = sfxDB.data.sfx.findIndex(item => String(item.id) === sfxID);
        if (sfxIndex === -1) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const [deletedSfx] = sfxDB.data.sfx.splice(sfxIndex, 1);
        await sfxDB.write();

        const soundsDir = path.join(__dirname, '../../public/sounds');
        const filename = path.basename(deletedSfx.url);
        const filePath = path.join(soundsDir, filename);
        let fileDeleted = false;

        try {
            await fs.unlink(filePath);
            fileDeleted = true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }

        return res.status(200).json({
            message: 'SFX deleted successfully',
            sfx: deletedSfx,
            fileDeleted,
        });
    })
);

router.put(
    '/:sfxID',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;
        const { name, downloads, tags } = req.body as { name?: string; downloads?: number; tags?: string[] };

        await sfxDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const index = sfxList.findIndex((item) => String(item.id) === sfxID);
        if (index === -1) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const current = sfxList[index];
        const nextName = typeof name === 'string' && name.trim() ? name.trim() : current.name;
        const nextDownloads = Number.isFinite(downloads)
            ? Math.max(0, Math.floor(Number(downloads)))
            : current.downloads;

        let nextTags = Array.isArray(current.tags) ? current.tags : [];
        if (Array.isArray(tags)) {
            nextTags = [...new Set(tags.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
        }

        sfxList[index] = {
            ...current,
            name: nextName,
            downloads: nextDownloads,
            tags: nextTags,
        };

        await sfxDB.write();

        return res.status(200).json({
            message: 'SFX updated successfully',
            sfx: sfxList[index],
        });
    })
);

export default router;
