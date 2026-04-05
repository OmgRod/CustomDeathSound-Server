import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { sfxDB, tagAuditDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import rateLimiter from '../utils/rateLimiter';
import { v4 as uuidv4 } from 'uuid';
import { analyzeAudioFile, computeAutoTags, normalizeLengthSeconds } from '../utils/audioAnalysis';

const router = express.Router();

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
        await tagAuditDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const soundsDir = path.join(__dirname, '../../public/sounds');
        const moderatorProtectedIds = new Set(
            (tagAuditDB.data?.entries || [])
                .filter((entry) => entry.actorRole === 'moderator' && (entry.addedTags.length > 0 || entry.removedTags.length > 0))
                .map((entry) => entry.sfxId),
        );

        const thresholdDbFs = 0;
        let updatedCount = 0;
        let removedTagsCount = 0;
        let longCount = 0;
        let loudCount = 0;
        const skippedModeratorProtected: string[] = [];
        const failed: Array<{ id: string; reason: string }> = [];

        for (const item of sfxList) {
            if (moderatorProtectedIds.has(item.id)) {
                skippedModeratorProtected.push(item.id);
                continue;
            }

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
                item.lengthSeconds = normalizeLengthSeconds(analysis.durationSeconds);
                const nextTags = computeAutoTags(analysis, thresholdDbFs);

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
            skippedModeratorProtectedCount: skippedModeratorProtected.length,
            skippedModeratorProtected,
            failedCount: failed.length,
            failed,
            note: 'The macro replaces the full tags array with the computed tags for each sound.',
        });
    })
);

router.post(
    '/admin/macros/calculate-lengths',
    rateLimiter(10, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        await sfxDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const soundsDir = path.join(__dirname, '../../public/sounds');

        let updatedCount = 0;
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
                const nextLength = normalizeLengthSeconds(analysis.durationSeconds);
                if (item.lengthSeconds !== nextLength) {
                    item.lengthSeconds = nextLength;
                    updatedCount += 1;
                }
            } catch (error) {
                failed.push({ id: item.id, reason: error instanceof Error ? error.message : 'analyze-failed' });
            }
        }

        await sfxDB.write();

        return res.status(200).json({
            message: 'Length macro completed.',
            updatedCount,
            failedCount: failed.length,
            failed,
        });
    })
);

router.get(
    '/:sfxID/tag-audit',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin', 'moderator']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;

        await sfxDB.read();
        const sfxExists = (sfxDB.data?.sfx || []).some((item) => String(item.id) === sfxID);
        if (!sfxExists) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        await tagAuditDB.read();
        const entries = (tagAuditDB.data?.entries || [])
            .filter((entry) => entry.sfxId === sfxID)
            .sort((a, b) => b.createdAt - a.createdAt);

        return res.status(200).json({ entries });
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
    requireRole(['admin', 'moderator']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;
        const { name, downloads, tags } = req.body as { name?: string; downloads?: number; tags?: string[] };

        await sfxDB.read();
        await tagAuditDB.read();
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

        const normalizedCurrentTags = [...new Set((Array.isArray(current.tags) ? current.tags : []).map((item) => String(item).trim().toLowerCase()).filter(Boolean))].sort();
        const normalizedNextTags = [...new Set(nextTags)].sort();

        sfxList[index] = {
            ...current,
            name: nextName,
            downloads: nextDownloads,
            tags: nextTags,
        };

        await sfxDB.write();

        if (JSON.stringify(normalizedCurrentTags) !== JSON.stringify(normalizedNextTags)) {
            const addedTags = normalizedNextTags.filter((tag) => !normalizedCurrentTags.includes(tag));
            const removedTags = normalizedCurrentTags.filter((tag) => !normalizedNextTags.includes(tag));

            tagAuditDB.data?.entries.push({
                id: uuidv4(),
                sfxId: current.id,
                actorId: req.user?.githubId || 'unknown',
                actorRole: req.user?.role || 'user',
                action: 'manual-tag-update',
                addedTags,
                removedTags,
                resultingTags: normalizedNextTags,
                createdAt: Math.floor(Date.now() / 1000),
            });
            await tagAuditDB.write();
        }

        return res.status(200).json({
            message: 'SFX updated successfully',
            sfx: sfxList[index],
        });
    })
);

export default router;
