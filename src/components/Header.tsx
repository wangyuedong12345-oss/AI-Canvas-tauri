/**
 * Header 顶部栏 — Logo、项目名编辑、侧边栏切换、设置入口、窗口拖拽区域
 */
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { useT } from '../i18n';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
const isMacOS = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent);

export default function Header() {
  const t = useT();
  const { projectName, setProjectName, createProject, isCreatingProject } = useAppStore(
    useShallow((s) => ({
      projectName: s.projectName,
      setProjectName: s.setProjectName,
      createProject: s.createProject,
      isCreatingProject: s.isCreatingProject,
    })),
  );
  // 当前画布是一集时，名字前面挂上剧集名：「项目 4-第 1 集」。可编辑的仍然只有集名。
  const seriesName = useAppStore((s) => {
    const current = s.projects.find((project) => project.id === s.currentProjectId);
    return current?.parentId
      ? s.projects.find((project) => project.id === current.parentId)?.name ?? ''
      : '';
  });
  const macTauriPlacement = isTauri && isMacOS;

  return (
    <header
      data-tauri-drag-region
      className={`app-header absolute top-2 z-40 flex items-center gap-1 px-2 py-2
                  bg-canvas-surface/60 backdrop-blur-xl border border-canvas-border rounded-[14px]
                  shadow-lg shadow-black/30 select-none ${
                    macTauriPlacement ? 'right-2' : 'left-2'
                  }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 pr-1">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
          <img src="/logo.svg" alt="ZeroFrame" className="w-full h-full" />
        </div>
        <span className="text-[11px] font-semibold text-canvas-text/90">ZeroFrame</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--separator-color)] mx-0.5" />

      {/* Project Name */}
      {seriesName && (
        <>
          <span className="max-w-[110px] truncate pl-2 text-[11px] text-canvas-text-secondary/70">
            {seriesName}
          </span>
          <span className="text-[11px] text-canvas-text-muted">-</span>
        </>
      )}
      <div
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => {
          const name = e.currentTarget.textContent?.trim() || t('新项目');
          setProjectName(name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        }}
        className={`text-[11px] text-canvas-text-secondary/80 ${seriesName ? 'pl-1 pr-2' : 'px-2'} py-0.5 rounded-md
                   hover:bg-canvas-hover outline-none cursor-text min-w-[50px] max-w-[140px] truncate
                   focus:text-canvas-text/90 transition-colors`}
      >
        {projectName}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--separator-color)] mx-0.5" />

      {/* Actions */}
      <motion.button
        type="button"
        aria-label={isCreatingProject ? t('正在新建画布') : t('新建画布')}
        onClick={() => void createProject()}
        disabled={isCreatingProject}
        className="w-7 h-7 rounded-lg hover:bg-canvas-hover flex items-center justify-center
                   text-canvas-text-secondary hover:text-canvas-text disabled:cursor-not-allowed disabled:opacity-50"
        data-tooltip={isCreatingProject ? t('正在新建画布') : t('新建画布')}
        whileHover={isCreatingProject ? undefined : { scale: 1.1 }}
        whileTap={isCreatingProject ? undefined : { scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {isCreatingProject ? (
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </motion.button>
    </header>
  );
}
