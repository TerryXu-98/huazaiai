import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Check,
  Cloud,
  ExternalLink,
  Film,
  FolderOpen,
  Hand,
  Image as ImageIcon,
  Menu,
  Moon,
  MousePointer2,
  Music,
  Frame,
  Plus,
  Save,
  Settings,
  Sun,
  Trash2,
  Type,
  Upload,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useThemeStore } from './stores/theme';
import { useApiKeysStore } from './stores/apiKeys';
import { useCanvasStore } from './stores/canvas';
import Sidebar from './components/Sidebar';
import Canvas, { type CanvasInteractionMode } from './components/Canvas';
import ApiSettingsModal from './components/ApiSettings';
import ErrorBoundary from './components/ErrorBoundary';
import * as api from './services/api';
import type { CanvasListItem, NodeType } from './types/canvas';

declare const __APP_VERSION__: string;
declare global {
  interface Window {
    liang?: {
      getInfo?: () => Promise<any>;
      openPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
      openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>;
      chooseDirectory?: () => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>;
      downloadToDirectory?: (payload: { url: string; directory: string; fileName?: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    };
  }
}

const PROJECT_NAME = 'HUAZAIDESIGN';
const RECENT_VISIBLE_LIMIT = 5;
const RECENT_MORE_LIMIT = 20;
const UPDATE_REPO = 'liang2045/huazaiai';
const UPDATE_CHECK_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;

type UpdateNotice = {
  version: string;
  url: string;
  assetUrl?: string;
};

type DownloadNotice = {
  kind: 'success' | 'error';
  message: string;
  path?: string;
  directory?: string;
  fileName?: string;
};

function normalizeVersion(value: string) {
  return String(value || '').trim().replace(/^v/i, '').split(/[+-]/)[0];
}

function compareVersions(a: string, b: string) {
  const pa = normalizeVersion(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pb = normalizeVersion(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

const BOTTOM_CORE_NODES: Array<{
  type: NodeType;
  label: string;
  icon: typeof Upload;
  accent: string;
}> = [
  { type: 'upload', label: '上传图像', icon: Upload, accent: '#a9b8ae' },
  { type: 'drawing-board', label: '画框', icon: Frame, accent: '#bbb196' },
  { type: 'text', label: '文字', icon: Type, accent: '#aab5ba' },
  { type: 'image', label: '图像生成', icon: ImageIcon, accent: '#c0b594' },
  { type: 'video', label: '视频生成', icon: Video, accent: '#b6a0a3' },
  { type: 'seedance', label: 'SD2.0', icon: Film, accent: '#b0a6b6' },
  { type: 'audio', label: '音频', icon: Music, accent: '#aaa5b7' },
  { type: 'llm', label: 'LLM', icon: Brain, accent: '#9fb4aa' },
];

function App() {
  const { theme, toggleTheme } = useThemeStore();
  const { settings, load: loadSettings } = useApiKeysStore();
  const { canvases, createCanvas, deleteCanvas, loadCanvases, loading: canvasLoading, setActive } = useCanvasStore();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectStarted, setProjectStarted] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [savingCanvas, setSavingCanvas] = useState(false);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('select');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null);
  const [updateNotice, setUpdateNotice] = useState<UpdateNotice | null>(null);
  const [hiddenRecentIds, setHiddenRecentIds] = useState<Set<string>>(() => new Set());
  const [recentMoreOpen, setRecentMoreOpen] = useState(false);
  const [recentMenu, setRecentMenu] = useState<{ x: number; y: number; canvas: CanvasListItem } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingRecentId, setDeletingRecentId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const addNodeRef = useRef<((type: NodeType) => void) | null>(null);
  const saveCanvasRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme-style', 'tech');
    root.setAttribute('data-theme-mode', theme);
    root.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, [theme]);

  useEffect(() => {
    const apply = (el: Element) => {
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
        if (tag !== 'SELECT') {
          el.setAttribute('spellcheck', 'false');
          el.setAttribute('autocorrect', 'off');
          el.setAttribute('autocapitalize', 'off');
        }
        el.classList.add('nodrag', 'nowheel');
      }
    };
    document.querySelectorAll('textarea, input, select').forEach(apply);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          apply(el);
          el.querySelectorAll?.('textarea, input, select').forEach(apply);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    loadCanvases();
  }, [loadCanvases]);

  useEffect(() => {
    const check = async () => {
      const ok = await api.checkBackendStatus();
      setBackendStatus(ok ? 'ok' : 'error');
    };
    check();
    const t = window.setInterval(check, 15_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let cancelled = false;
    const checkUpdate = async () => {
      try {
        const res = await fetch(UPDATE_CHECK_URL, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const release = await res.json();
        const latest = String(release?.tag_name || release?.name || '');
        if (!latest || compareVersions(latest, __APP_VERSION__) <= 0) return;
        const assets = Array.isArray(release?.assets) ? release.assets : [];
        const installer = assets.find((asset: any) =>
          typeof asset?.name === 'string' &&
          /^HuazaiAI-Setup-.*\.exe$/i.test(asset.name) &&
          typeof asset?.browser_download_url === 'string'
        );
        if (!cancelled) {
          setUpdateNotice({
            version: normalizeVersion(latest),
            url: release?.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`,
            assetUrl: installer?.browser_download_url,
          });
        }
      } catch {
        // Update checks are best-effort and should never block startup.
      }
    };
    void checkUpdate();
    const timer = window.setInterval(checkUpdate, 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setDownloadNotice({
        kind: 'success',
        message: '已保存到下载文件夹',
        path: detail.path,
        directory: detail.directory,
        fileName: detail.fileName,
      });
    };
    const onError = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setDownloadNotice({
        kind: 'error',
        message: detail.message || '下载失败',
        directory: detail.directory,
      });
    };
    window.addEventListener('huazai:download-complete', onComplete);
    window.addEventListener('huazai:download-error', onError);
    return () => {
      window.removeEventListener('huazai:download-complete', onComplete);
      window.removeEventListener('huazai:download-error', onError);
    };
  }, []);

  const isDark = theme === 'dark';
  const ActiveToolIcon = interactionMode === 'select' ? MousePointer2 : Hand;
  const visibleRecentCanvases = canvases.filter((canvas) => !hiddenRecentIds.has(canvas.id));
  const recentCanvases = visibleRecentCanvases.slice(0, RECENT_VISIBLE_LIMIT);
  const moreRecentCanvases = visibleRecentCanvases.slice(0, RECENT_MORE_LIMIT);
  const hasMoreRecentCanvases = moreRecentCanvases.length > recentCanvases.length;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const beginToolPress = () => {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      setToolMenuOpen(true);
      longPressTimer.current = null;
    }, 360);
  };

  const selectTool = (mode: CanvasInteractionMode) => {
    setInteractionMode(mode);
    setToolMenuOpen(false);
  };

  const handleCreateProject = async () => {
    if (creatingProject) return;
    setCreatingProject(true);
    const item = await createCanvas(PROJECT_NAME);
    if (item) setProjectStarted(true);
    setCreatingProject(false);
  };

  const openRecentCanvas = (id: string) => {
    setRecentMenu(null);
    setRecentMoreOpen(false);
    setConfirmDeleteId(null);
    setActive(id);
    setProjectStarted(true);
  };

  const closeRecentPreview = (id: string) => {
    setHiddenRecentIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRecentMenu((menu) => (menu?.canvas.id === id ? null : menu));
    if (confirmDeleteId === id) setConfirmDeleteId(null);
  };

  const requestDeleteRecent = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDeleteRecent = async (id: string) => {
    if (deletingRecentId) return;
    setDeletingRecentId(id);
    try {
      await deleteCanvas(id);
      await loadCanvases();
      setHiddenRecentIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setRecentMenu(null);
      setConfirmDeleteId(null);
    } finally {
      setDeletingRecentId(null);
    }
  };

  const saveCanvasNow = async () => {
    if (!saveCanvasRef.current || savingCanvas) return;
    setSavingCanvas(true);
    try {
      await saveCanvasRef.current();
      await loadCanvases();
    } finally {
      window.setTimeout(() => setSavingCanvas(false), 350);
    }
  };

  const openSharedFolder = async () => {
    const targetPath = settings.sharedFolderPath?.trim();
    if (!targetPath) {
      setSettingsOpen(true);
      return;
    }
    try {
      if (window.liang?.openPath) {
        const result = await window.liang.openPath(targetPath);
        if (result?.ok) return;
        throw new Error(result?.error || '无法打开共享文件夹');
      }
      const res = await fetch('/api/files/open-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) return;
      throw new Error(json?.error || `HTTP ${res.status}`);
    } catch (err) {
      setDownloadNotice({
        kind: 'error',
        message: `无法打开共享文件夹：${err instanceof Error ? err.message : String(err)}`,
        directory: targetPath,
      });
    }
  };

  const openNetdisk = async () => {
    const rawUrl = settings.netdiskUrl?.trim();
    if (!rawUrl) {
      setSettingsOpen(true);
      return;
    }
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      if (window.liang?.openExternal) {
        const result = await window.liang.openExternal(url);
        if (result?.ok) return;
        throw new Error(result?.error || '无法打开云盘');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadNotice({
        kind: 'error',
        message: `无法打开云盘：${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const openDownloadDirectory = async () => {
    const directory = downloadNotice?.directory;
    if (!directory) return;
    try {
      if (window.liang?.openPath) {
        const result = await window.liang.openPath(directory);
        if (result?.ok) return;
        throw new Error(result?.error || '无法打开下载目录');
      }
      const res = await fetch('/api/files/open-download-directory', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) return;
      throw new Error(json?.error || `HTTP ${res.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDownloadNotice({
        kind: 'error',
        message: `下载失败：无法打开下载目录。${message}`,
        directory,
      });
    }
  };

  const openUpdateUrl = async () => {
    const targetUrl = updateNotice?.assetUrl || updateNotice?.url;
    if (!targetUrl) return;
    if (window.liang?.openExternal) {
      const result = await window.liang.openExternal(targetUrl);
      if (result?.ok) return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const renderUpdateNotice = () => {
    if (!updateNotice) return null;
    return (
      <div
        className={`fixed right-4 top-24 z-[91] flex max-w-[380px] items-center gap-2 rounded-full border px-2 py-1.5 text-xs shadow-2xl ${
          isDark
            ? 'border-emerald-300/20 bg-zinc-950/94 text-white'
            : 'border-emerald-700/15 bg-white/96 text-zinc-900'
        }`}
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <button
          type="button"
          onClick={openUpdateUrl}
          className={`flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-left ${
            isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
          }`}
          title="打开最新版本"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
          <span className="truncate font-medium">发现新版本 v{updateNotice.version}</span>
          <ExternalLink size={13} className={isDark ? 'text-white/55' : 'text-zinc-500'} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setUpdateNotice(null);
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isDark ? 'hover:bg-white/10 text-white/65' : 'hover:bg-black/5 text-zinc-600'
          }`}
          title="关闭提示"
        >
          <X size={13} />
        </button>
      </div>
    );
  };

  const renderDownloadNotice = () => {
    if (!downloadNotice) return null;
    const isError = downloadNotice.kind === 'error';
    return (
      <div
        className={`fixed right-4 top-14 z-[90] flex max-w-[360px] items-center gap-2 rounded-full border px-2 py-1.5 text-xs shadow-2xl ${
          isDark
            ? 'border-white/12 bg-zinc-950/92 text-white'
            : 'border-black/12 bg-white/96 text-zinc-900'
        }`}
        style={{ backdropFilter: 'blur(16px)' }}
      >
        <button
          type="button"
          onClick={openDownloadDirectory}
          className={`flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-left ${
            downloadNotice.directory
              ? isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              : ''
          }`}
          title={downloadNotice.directory ? '打开下载目录' : downloadNotice.message}
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              isError ? 'bg-red-400' : 'bg-emerald-400'
            }`}
          />
          <span className="truncate font-medium">{downloadNotice.message}</span>
          {downloadNotice.fileName && (
            <span className={isDark ? 'max-w-[120px] truncate text-white/45' : 'max-w-[120px] truncate text-zinc-500'}>
              {downloadNotice.fileName}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDownloadNotice(null);
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isDark ? 'hover:bg-white/10 text-white/65' : 'hover:bg-black/5 text-zinc-600'
          }`}
          title="关闭提示"
        >
          <X size={13} />
        </button>
      </div>
    );
  };

  const renderRecentCard = (canvas: CanvasListItem, compact = false) => {
    const isConfirming = confirmDeleteId === canvas.id;
    const isDeleting = deletingRecentId === canvas.id;
    return (
      <div
        key={canvas.id}
        className={`group relative overflow-hidden rounded-xl border text-left transition ${
          isDark
            ? 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'
            : 'border-black/10 bg-white/70 hover:bg-white'
        }`}
        onContextMenu={(e) => {
          e.preventDefault();
          setConfirmDeleteId(null);
          setRecentMenu({ x: e.clientX, y: e.clientY, canvas });
        }}
        title={canvas.name}
      >
        <button
          type="button"
          onClick={() => openRecentCanvas(canvas.id)}
          className="block w-full text-left"
        >
          <div className={`aspect-[4/3] overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
            {canvas.previewUrl ? (
              canvas.previewKind === 'video' ? (
                <video src={canvas.previewUrl} className="h-full w-full object-cover" muted draggable={false} />
              ) : (
                <img src={canvas.previewUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              )
            ) : (
              <div className="flex h-full items-center justify-center">
                <img src="/liang.svg" alt="" className={compact ? 'h-8 w-8 opacity-45' : 'h-9 w-9 opacity-45'} draggable={false} />
              </div>
            )}
          </div>
          <div className={compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}>
            <div className={`truncate text-xs font-medium ${isDark ? 'text-white/78' : 'text-zinc-800'}`}>{canvas.name}</div>
            <div className={`mt-0.5 text-[10px] ${isDark ? 'text-white/35' : 'text-zinc-500'}`}>{canvas.nodeCount} 个节点</div>
          </div>
        </button>

        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isConfirming ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void confirmDeleteRecent(canvas.id);
                }}
                disabled={isDeleting}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-lg disabled:opacity-50"
                title={isDeleting ? '正在删除' : '确认删除'}
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(null);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full shadow-lg ${
                  isDark ? 'bg-zinc-950/80 text-white hover:bg-zinc-900' : 'bg-white/90 text-zinc-700 hover:bg-white'
                }`}
                title="取消删除"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeRecentPreview(canvas.id);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full shadow-lg ${
                isDark ? 'bg-zinc-950/80 text-white hover:bg-zinc-900' : 'bg-white/90 text-zinc-700 hover:bg-white'
              }`}
              title="关闭预览"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderRecentContextMenu = () => {
    if (!recentMenu) return null;
    const { canvas } = recentMenu;
    const isConfirming = confirmDeleteId === canvas.id;
    const menuClass = isDark
      ? 'border-white/10 bg-zinc-950/96 text-white'
      : 'border-black/10 bg-white/98 text-zinc-900';
    const itemClass = isDark
      ? 'hover:bg-white/10 text-white/80'
      : 'hover:bg-black/5 text-zinc-700';
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[95] cursor-default"
          aria-label="关闭最近使用菜单"
          onClick={() => {
            setRecentMenu(null);
            setConfirmDeleteId(null);
          }}
        />
        <div
          className={`fixed z-[96] w-36 overflow-hidden rounded-xl border p-1 text-xs shadow-2xl ${menuClass}`}
          style={{ left: recentMenu.x, top: recentMenu.y, backdropFilter: 'blur(18px)' }}
        >
          <button
            type="button"
            onClick={() => openRecentCanvas(canvas.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${itemClass}`}
          >
            <ExternalLink size={13} />
            打开
          </button>
          <button
            type="button"
            onClick={() => closeRecentPreview(canvas.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${itemClass}`}
          >
            <X size={13} />
            关闭
          </button>
          {isConfirming ? (
            <div className="mt-1 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => void confirmDeleteRecent(canvas.id)}
                disabled={deletingRecentId === canvas.id}
                className="rounded-lg bg-red-500 px-2 py-2 text-white disabled:opacity-50"
              >
                确认
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className={`rounded-lg px-2 py-2 ${itemClass}`}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => requestDeleteRecent(canvas.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${
                isDark ? 'hover:bg-red-500/15 text-red-300' : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <Trash2 size={13} />
              删除
            </button>
          )}
        </div>
      </>
    );
  };

  if (!projectStarted) {
    return (
      <div className={`h-screen overflow-hidden ${isDark ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'}`}>
        {renderDownloadNotice()}
        {renderUpdateNotice()}
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`h-9 w-9 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="设置"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={toggleTheme}
            className={`h-9 w-9 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title={`切换到${isDark ? '浅色' : '深色'}模式`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <main className="flex h-full items-center justify-center px-6">
          <div className="text-center">
            <img src="/liang.svg" alt="" className="mx-auto mb-5 h-14 w-14" />
            <h1 className="text-3xl font-semibold tracking-wide">{PROJECT_NAME}</h1>
            <p className={`mt-3 text-sm ${isDark ? 'text-white/45' : 'text-zinc-500'}`}>
              {backendStatus === 'ok' ? '准备就绪' : backendStatus === 'checking' ? '正在连接服务...' : '服务未连接'}
            </p>
            <button
              onClick={handleCreateProject}
              disabled={creatingProject || canvasLoading || backendStatus !== 'ok'}
              className="mt-8 inline-flex h-14 items-center gap-2 rounded-full border px-8 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: isDark ? '#f3f0e8' : '#111111',
                color: isDark ? '#090909' : '#f5f5f5',
                borderColor: isDark ? 'rgba(255,255,255,.26)' : 'rgba(0,0,0,.26)',
                boxShadow: isDark
                  ? '0 18px 54px rgba(255,255,255,.14), 0 0 0 1px rgba(255,255,255,.08)'
                  : '0 18px 44px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.5) inset',
              }}
            >
              <Plus size={17} />
              {creatingProject ? '正在新建...' : '新建项目'}
            </button>

            {recentCanvases.length > 0 && (
              <div className="mt-10 w-[min(760px,calc(100vw-48px))] text-left">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`text-xs ${isDark ? 'text-white/45' : 'text-zinc-500'}`}>最近使用</div>
                  {hasMoreRecentCanvases && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecentMoreOpen(true);
                        setRecentMenu(null);
                        setConfirmDeleteId(null);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${
                        isDark ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-800'
                      }`}
                    >
                      更多
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {recentCanvases.map((canvas) => renderRecentCard(canvas))}
                </div>
              </div>
            )}
          </div>
        </main>
        {recentMoreOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-5">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-black/35"
              aria-label="关闭更多最近使用"
              onClick={() => {
                setRecentMoreOpen(false);
                setRecentMenu(null);
                setConfirmDeleteId(null);
              }}
            />
            <div
              className={`relative z-[91] max-h-[78vh] w-[min(900px,calc(100vw-40px))] overflow-hidden rounded-2xl border shadow-2xl ${
                isDark ? 'border-white/10 bg-zinc-950/96 text-white' : 'border-black/10 bg-white/98 text-zinc-900'
              }`}
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                <div>
                  <div className="text-sm font-semibold">最近使用</div>
                  <div className={`mt-0.5 text-[11px] ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
                    最多显示 20 个画布
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecentMoreOpen(false);
                    setRecentMenu(null);
                    setConfirmDeleteId(null);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-zinc-600'
                  }`}
                  title="关闭"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[calc(78vh-68px)] overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {moreRecentCanvases.map((canvas) => renderRecentCard(canvas, true))}
                </div>
              </div>
            </div>
          </div>
        )}
        {renderRecentContextMenu()}
        <ApiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      <header
        className={`flex items-center justify-between px-4 py-2 border-b ${
          isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <img src="/liang.svg" alt="" className="h-6 w-6" />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`h-8 w-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-zinc-700'}`}
            title={menuOpen ? '关闭菜单' : '打开菜单'}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <h1 className="text-sm font-semibold tracking-wide">{PROJECT_NAME}</h1>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/10 text-white/60' : 'bg-black/5 text-zinc-500'}`}>
            v{__APP_VERSION__}
          </span>
          <div
            className={`flex items-center gap-1.5 text-[11px] ${
              backendStatus === 'ok'
                ? 'text-emerald-400'
                : backendStatus === 'error'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {backendStatus === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
            {backendStatus === 'ok' && '后端已连接'}
            {backendStatus === 'error' && '后端未连接'}
            {backendStatus === 'checking' && '检测中...'}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={saveCanvasNow}
            className={`h-8 w-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title={savingCanvas ? '已保存' : '保存画布'}
          >
            <Save size={16} />
          </button>
          <button
            onClick={openSharedFolder}
            className={`h-8 w-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="共享文件"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={openNetdisk}
            className={`h-8 w-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="网盘"
          >
            <Cloud size={16} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className={`h-8 w-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="设置"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={toggleTheme}
            className={`h-8 w-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title={`切换到${isDark ? '浅色' : '深色'}模式`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {menuOpen && (
          <>
            <button
              className="fixed inset-0 z-30 cursor-default"
              aria-label="关闭菜单"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-3 top-3 z-40">
              <Sidebar
                floating
                hiddenGroups={['input', 'core']}
                onAddNode={(type) => {
                  addNodeRef.current?.(type);
                  setMenuOpen(false);
                }}
              />
            </div>
          </>
        )}

        <ErrorBoundary fallbackTitle="画布渲染出错，已被错误边界捕获">
          <Canvas onAddNodeRef={addNodeRef} onSaveRef={saveCanvasRef} interactionMode={interactionMode} />
        </ErrorBoundary>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <div
            className={`pointer-events-auto relative flex items-center gap-2 rounded-full border px-2.5 py-2 ${
              isDark ? 'border-white/10 bg-zinc-950/84' : 'border-black/10 bg-white/90'
            }`}
            style={{ backdropFilter: 'blur(18px)', boxShadow: '0 18px 60px rgba(0,0,0,.34)' }}
          >
            {toolMenuOpen && (
              <div
                className={`absolute bottom-[58px] left-0 w-32 overflow-hidden rounded-2xl border p-1.5 ${
                  isDark ? 'border-white/10 bg-zinc-950/95' : 'border-black/10 bg-white/95'
                }`}
                style={{ backdropFilter: 'blur(18px)', boxShadow: '0 18px 44px rgba(0,0,0,.35)' }}
              >
                <button
                  onClick={() => selectTool('select')}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${
                    interactionMode === 'select'
                      ? isDark ? 'bg-white/14 text-white' : 'bg-black/10 text-zinc-900'
                      : isDark ? 'text-white/70 hover:bg-white/10' : 'text-zinc-600 hover:bg-black/5'
                  }`}
                >
                  <MousePointer2 size={14} />
                  选择
                </button>
                <button
                  onClick={() => selectTool('move')}
                  className={`mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${
                    interactionMode === 'move'
                      ? isDark ? 'bg-white/14 text-white' : 'bg-black/10 text-zinc-900'
                      : isDark ? 'text-white/70 hover:bg-white/10' : 'text-zinc-600 hover:bg-black/5'
                  }`}
                >
                  <Hand size={14} />
                  移动
                </button>
              </div>
            )}

            <button
              onPointerDown={beginToolPress}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onContextMenu={(e) => {
                e.preventDefault();
                setToolMenuOpen(true);
              }}
              title="长按选择工具"
              className={`flex h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full p-0 transition ${
                isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black/8 text-zinc-800 hover:bg-black/10'
              }`}
            >
              <ActiveToolIcon size={18} />
            </button>

            {BOTTOM_CORE_NODES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => addNodeRef.current?.(item.type)}
                  title={item.label}
                  className={`flex h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full p-0 transition ${
                    isDark ? 'text-white/82 hover:bg-white/10' : 'text-zinc-700 hover:bg-black/5'
                  }`}
                  style={{ color: item.accent }}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ApiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {renderDownloadNotice()}
      {renderUpdateNotice()}
    </div>
  );
}

export default App;
