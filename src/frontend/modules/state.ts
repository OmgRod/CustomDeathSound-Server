// App state and shared variables
import type { CurrentUser, PackItem, SfxItem } from './types';


let recentSort = true;
let currentUser: CurrentUser | null = null;
let sfxPage = 1;
let sfxTotalPages = 1;
let packPage = 1;
let packTotalPages = 1;
const frontendActionCooldowns = new Map<string, number>();
let activeAudio: HTMLAudioElement | null = null;
let adminPackOptions: PackItem[] = [];
let packEditorSelectedIds: string[] = [];
let packEditorEditingPackId: string | null = null;
let packEditorSearchResults: SfxItem[] = [];
let packEditorSearchTimer: number | null = null;
const packEditorSfxMeta = new Map<string, SfxItem>();
let sfxSearchQuery = '';
let packSearchQuery = '';
let sfxSearchTimer: number | null = null;
let packSearchTimer: number | null = null;
let sfxEditorEditingId: string | null = null;
let adminDetectedIp: string | null = null;

export const state = {
	recentSort,
	currentUser,
	sfxPage,
	sfxTotalPages,
	packPage,
	packTotalPages,
	frontendActionCooldowns,
	activeAudio,
	adminPackOptions,
	packEditorSelectedIds,
	packEditorEditingPackId,
	packEditorSearchResults,
	packEditorSearchTimer,
	packEditorSfxMeta,
	sfxSearchQuery,
	packSearchQuery,
	sfxSearchTimer,
	packSearchTimer,
	sfxEditorEditingId,
	adminDetectedIp
};

export function setRecentSort(val: boolean) { recentSort = val; }
export function setCurrentUser(val: CurrentUser | null) { currentUser = val; }
export function setSfxPage(val: number) { sfxPage = val; }
export function setSfxTotalPages(val: number) { sfxTotalPages = val; }
export function setPackPage(val: number) { packPage = val; }
export function setPackTotalPages(val: number) { packTotalPages = val; }
