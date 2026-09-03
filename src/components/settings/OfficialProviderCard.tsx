import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ApiProviderConfig, GeneralModelCategory, ProviderModelSelection } from '../../types';
import { GENERAL_MODEL_CATEGORY_LABELS } from '../../types';
import {
  OFFICIAL_PROVIDER_BADGE,
  OFFICIAL_PROVIDER_ID,
  OFFICIAL_PROVIDER_NAME,
  fetchOfficialModels,
  isOfficialProviderAvailable,
  mergeOfficialModels,
  officialProviderBaseUrl,
  officialProviderRegisterUrl,
  type OfficialProviderStatus,
} from '../../services/ai/officialProviderService';
import AnimatedButton from '../shared/AnimatedButton';
import { useT } from '../../i18n';

const CATEGORY_ORDER: GeneralModelCategory[] = ['text', 'image', 'video', 'audio'];

function categorySummary(models: ProviderModelSelection[], t: ReturnType<typeof useT>): string {
  const parts = CATEGORY_ORDER.flatMap((category) => {
    const count = models.filter((model) => model.category === category).length;
    return count > 0 ? [t('{count} 个{type}', { count, type: GENERAL_MODEL_CATEGORY_LABELS[category] })] : [];
  });
  return parts.length > 0 ? t('已同步 {summary}模型', { summary: parts.join(' / ') }) : t('未选择模型');
}

function statusLabel(status: OfficialProviderStatus, t: ReturnType<typeof useT>): string {
  switch (status) {
    case 'syncing':
      return t('同步中');
    case 'connected':
      return t('已连接');
    case 'failed':
      return t('连接失败');
    case 'unavailable':
      return t('不可用');
    case 'unconfigured':
    default:
      return t('未配置');
  }
}

function modelCountSubtitle(
  status: OfficialProviderStatus,
  catalogModels: ProviderModelSelection[],
  t: ReturnType<typeof useT>,
): string {
  if (status === 'unavailable') return t('官方渠道不可用');
  if (status === 'syncing') return t('同步中…');
  if (catalogModels.length > 0) return t('{count} 个模型', { count: catalogModels.length });
  return t('待同步模型');
}

function groupedModels(models: ProviderModelSelection[]): Array<{
  category: GeneralModelCategory;
  models: ProviderModelSelection[];
}> {
  return CATEGORY_ORDER.flatMap((category) => {
    const items = models.filter((model) => model.category === category);
    return items.length > 0 ? [{ category, models: items }] : [];
  });
}

export default function OfficialProviderCard({
  focusRequested,
  onFocusConsumed,
}: {
  focusRequested: boolean;
  onFocusConsumed: () => void;
}) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const config = useAppStore((state) => state.config);
  const saveProviderConfig = useAppStore((state) => state.saveProviderConfig);
  const setProviderConfig = useAppStore((state) => state.setProviderConfig);
  const saveConfig = useAppStore((state) => state.saveConfig);
  const showToast = useAppStore((state) => state.showToast);
  const provider = config.providers[OFFICIAL_PROVIDER_ID];
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GeneralModelCategory>('text');
  const [syncing, setSyncing] = useState(false);
  const [transientMessage, setTransientMessage] = useState('');

  const available = isOfficialProviderAvailable();
  const catalogModels = useMemo(() => provider?.catalogModels ?? [], [provider?.catalogModels]);
  const selectedModels = useMemo(() => provider?.selectedModels ?? [], [provider?.selectedModels]);
  const selectedIds = useMemo(() => new Set(selectedModels.map((model) => model.id)), [selectedModels]);
  const status: OfficialProviderStatus = !available
    ? 'unavailable'
    : syncing
      ? 'syncing'
      : !provider?.apiKey
        ? 'unconfigured'
        : provider.officialStatus ?? 'connected';

  useEffect(() => {
    if (!focusRequested) return;
    cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    cardRef.current?.classList.add('is-focus-pulse');
    const timer = window.setTimeout(() => cardRef.current?.classList.remove('is-focus-pulse'), 1200);
    onFocusConsumed();
    return () => window.clearTimeout(timer);
  }, [focusRequested, onFocusConsumed]);

  const displayExpanded = expanded || status === 'failed' || Boolean(transientMessage);

  const saveOfficialConfig = async (next: ApiProviderConfig, silent = true) => {
    saveProviderConfig(OFFICIAL_PROVIDER_ID, next);
    await saveConfig({ silent });
  };

  const handleSync = async () => {
    if (!available) return;
    const newKey = apiKeyInput.trim();
    const keyToUse = newKey || provider?.apiKey?.trim() || '';
    if (!keyToUse) {
      showToast(t('请先填写官方接口 API Key'), 'error');
      return;
    }

    setSyncing(true);
    setTransientMessage('');
    if (provider) setProviderConfig(OFFICIAL_PROVIDER_ID, { officialStatus: 'syncing' });
    try {
      const result = await fetchOfficialModels(keyToUse);
      const hiddenModelIds = provider?.officialHiddenModelIds ?? [];
      const selected = mergeOfficialModels(result.models, provider?.selectedModels, hiddenModelIds);
      await saveOfficialConfig({
        name: OFFICIAL_PROVIDER_NAME,
        apiKey: keyToUse,
        baseUrl: officialProviderBaseUrl(),
        catalogId: OFFICIAL_PROVIDER_ID,
        catalogModels: result.models,
        selectedModels: selected,
        visibleModelCategories: CATEGORY_ORDER.filter((category) =>
          result.models.some((model) => model.category === category),
        ),
        catalogUpdatedAt: Date.now(),
        officialStatus: 'connected',
        officialHiddenModelIds: hiddenModelIds.filter((id) => result.models.some((model) => model.id === id)),
      });
      setApiKeyInput('');
      setTransientMessage(result.skippedCount > 0 ? t('部分模型未能同步') : '');
      showToast(t('官方模型已同步'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('模型同步失败');
      setTransientMessage(message);
      if (provider?.apiKey) {
        await saveOfficialConfig({ ...provider, officialStatus: 'failed', apiKey: provider.apiKey }, true);
      } else {
        setProviderConfig(OFFICIAL_PROVIDER_ID, {
          name: OFFICIAL_PROVIDER_NAME,
          apiKey: '',
          catalogId: OFFICIAL_PROVIDER_ID,
          officialStatus: 'unconfigured',
        });
      }
      showToast(t('模型同步失败：{message}', { message }), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const updateSelectedModels = async (nextSelected: ProviderModelSelection[]) => {
    const selectedIdSet = new Set(nextSelected.map((model) => model.id));
    const next: ApiProviderConfig = {
      ...(provider ?? {
        name: OFFICIAL_PROVIDER_NAME,
        apiKey: '',
        catalogId: OFFICIAL_PROVIDER_ID,
      }),
      selectedModels: nextSelected,
      catalogModels,
      visibleModelCategories: CATEGORY_ORDER.filter((category) =>
        nextSelected.some((model) => model.category === category),
      ),
      officialHiddenModelIds: catalogModels
        .filter((model) => !selectedIdSet.has(model.id))
        .map((model) => model.id),
    };
    await saveOfficialConfig(next, true);
  };

  const toggleModel = (model: ProviderModelSelection, checked: boolean) => {
    const next = checked
      ? [...selectedModels, model].filter((item, index, array) =>
          array.findIndex((candidate) => candidate.id === item.id) === index,
        )
      : selectedModels.filter((item) => item.id !== model.id);
    void updateSelectedModels(next);
  };

  const setCategoryChecked = (category: GeneralModelCategory, checked: boolean) => {
    const categoryModels = catalogModels.filter((model) => model.category === category);
    const categoryIds = new Set(categoryModels.map((model) => model.id));
    const others = selectedModels.filter((model) => !categoryIds.has(model.id));
    void updateSelectedModels(checked ? [...others, ...categoryModels] : others);
  };

  const openRegister = async () => {
    const url = officialProviderRegisterUrl();
    if (!url) return;
    try {
      await import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const groups = groupedModels(catalogModels);
  const activeCategoryModels = catalogModels.filter((model) => model.category === activeCategory);
  const activeSelectedCount = activeCategoryModels.filter((model) => selectedIds.has(model.id)).length;
  const activeAllChecked = activeCategoryModels.length > 0 && activeSelectedCount === activeCategoryModels.length;

  return (
    <div ref={cardRef} className="official-provider-card provider-connection-card">
      <div className={`provider-badge provider-badge--${OFFICIAL_PROVIDER_ID}`}>{OFFICIAL_PROVIDER_BADGE}</div>
      <div className="official-provider-content">
        <div className="provider-connection-title-row">
          <strong>{t(OFFICIAL_PROVIDER_NAME)}</strong>
          <span className={`provider-list-status${status === 'connected' || status === 'syncing' ? '' : ' is-limited'}`}>
            {statusLabel(status, t)}
          </span>
          <span className="provider-connection-meta-inline">{modelCountSubtitle(status, catalogModels, t)}</span>
          <button type="button" className="official-provider-register-link" onClick={() => void openRegister()}>
            {t('前往获取API Key')}
            <Icon icon="mdi:open-in-new" width="12" />
          </button>
        </div>

        <div className="official-provider-form">
          <label>
            <span>{t('API Key')} *</span>
            <input
              type="password"
              value={apiKeyInput}
              placeholder={provider?.apiKey ? '••••••••' : ''}
              disabled={!available || syncing}
              onChange={(event) => setApiKeyInput(event.target.value)}
            />
          </label>
          <AnimatedButton
            type="button"
            className="provider-primary-btn official-provider-sync-btn"
            disabled={!available || syncing}
            onClick={() => void handleSync()}
          >
            {syncing ? t('同步中…') : t('拉取/启用模型')}
          </AnimatedButton>
          <label className="official-provider-url-field">
            <span>{t('接口地址')} *</span>
            <input type="text" value={officialProviderBaseUrl()} readOnly disabled={!available} />
          </label>
        </div>

        <div className="official-provider-footer">
          <span className="official-provider-summary">
            {status === 'unavailable'
              ? t('官方渠道配置缺失')
              : transientMessage || (status === 'connected'
                ? categorySummary(selectedModels, t)
                : t('填写 API Key 后自动配置文本/图像/视频/音频模型'))}
          </span>
          {groups.length > 0 && (
            <button
              type="button"
              className="official-provider-expand-btn"
              onClick={() => setExpanded((value) => !value)}
            >
              {displayExpanded ? t('收起模型') : t('展开模型')}
            </button>
          )}
        </div>

        {displayExpanded && groups.length > 0 && (
          <div className="official-provider-model-groups">
            <div className="official-provider-category-tabs" role="tablist" aria-label={t('模型类型')}>
              {CATEGORY_ORDER.map((category) => {
                const count = catalogModels.filter((model) => model.category === category).length;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category}
                    className={`provider-category-choice is-${category}${activeCategory === category ? ' is-active' : ''}`}
                    onClick={() => setActiveCategory(category)}
                  >
                    {GENERAL_MODEL_CATEGORY_LABELS[category]}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="official-provider-model-actions">
              <label>
                <input
                  type="checkbox"
                  checked={activeAllChecked}
                  disabled={activeCategoryModels.length === 0}
                  onChange={(event) => setCategoryChecked(activeCategory, event.target.checked)}
                />
                <span>{activeAllChecked ? t('取消全选') : t('选择当前结果')}</span>
              </label>
              <span>{t('{count} 个已选', { count: activeSelectedCount })}</span>
            </div>
            <div className="official-provider-model-group">
              <div className="provider-model-list">
                {activeCategoryModels.length === 0 ? (
                  <div className="official-provider-model-empty">{t('该类型暂无模型')}</div>
                ) : activeCategoryModels.map((model) => (
                  <div key={model.id} className="provider-model-row">
                    <label className="provider-model-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(model.id)}
                        onChange={(event) => toggleModel(model, event.target.checked)}
                      />
                      <span className={`provider-model-kind is-${model.category}`}>
                        {GENERAL_MODEL_CATEGORY_LABELS[model.category]}
                      </span>
                      <span className="provider-model-copy">
                        <strong>{model.name}</strong>
                        <small>ID: {model.id}</small>
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
