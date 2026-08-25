window.__ModuleLoader__.load({
  id: '@dsh-local/model-management',
  factory: (require) => {
    const module = { exports: {} };
    const react = require('react');
    const CONTROL_NS = 'model-management-control';
    const DEFAULT_NS = 'agent-default-model';
    const visibility = require('@dsh-local/model-management/model-visibility');
    const directoryCompat = require('@dsh-local/model-management/model-directory-compat');
    const css = `
      .mm{max-width:720px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:8px}.mm-title{margin:0;font-size:16px;font-weight:500;line-height:24px}.mm-intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px}.mm-notice{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.mm-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.mm-rows{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}.mm-row-card{display:flex;flex-direction:column;gap:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px}.mm-row-head{display:flex;align-items:center;gap:10px;min-height:28px;cursor:pointer}.mm-row-head:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.mm-row-name{font-size:14px;font-weight:500;line-height:22px}.mm-provider-actions{display:flex;align-items:center;gap:6px;margin-left:auto}.mm-button.mm-collapse{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;height:24px;padding:0;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary);pointer-events:none}.mm-button.mm-collapse::before{box-sizing:border-box;width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;content:"";transform:rotate(45deg) translate(-2px,-2px)}.mm-button.mm-collapse[aria-expanded=false]::before{transform:rotate(-45deg) translate(-1px,1px)}.mm-models{display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2)}.mm-model{box-sizing:border-box;display:flex;align-items:center;gap:10px;height:66px;min-height:66px;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}.mm-model:last-child{border-bottom:0}.mm-model-copy{display:flex;flex:1;flex-direction:column;justify-content:center;min-width:0}.mm-model-name{font-size:14px;line-height:20px}.mm-model-id{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.mm-actions{display:flex;flex:none;gap:6px}.mm-button{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:12px/18px inherit;cursor:pointer}.mm-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.mm-button.primary{border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.mm-button:disabled{opacity:.45;cursor:default}.mm-state{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}@media(max-width:540px){.mm-model{align-items:flex-start;flex-direction:column;padding:8px 0}.mm-actions{width:100%}.mm-button{flex:1}}
    `;

    const text = (error) => error instanceof Error ? error.message : String(error);
    const keyOf = visibility.modelVisibilityKey;
    const filterGroups = visibility.filterModelGroups;

    function installModelSelectionFilter(ctx, connection, remote) {
      const directories = ctx.get('modelDirectories');
      let control = { hidden: [], disabledProviders: [] };
      let warned = false;

      const refreshControl = async () => {
        const response = await connection.api.settings.describe({});
        if (!response.result.ok) throw new Error(response.result.error.message);
        const entry = response.result.value.namespaces.find((namespace) => namespace.ns === CONTROL_NS);
        control = {
          hidden: entry?.value?.hidden || [],
          disabledProviders: entry?.value?.disabledProviders || [],
        };
      };

      const compat = directoryCompat.createModelDirectoryCompat({
        directories,
        getControl: () => control,
        onIncompatible: (reason) => {
          if (warned) return;
          warned = true;
          console.warn(`model-management: native model picker filtering is unavailable: ${reason}`);
        },
      });
      if (!compat.compatible) return () => {};

      refreshControl().then(() => compat.refresh()).catch((error) => {
        console.warn(`model-management: could not read model visibility settings: ${text(error)}`);
      });
      const stop = remote?.$on?.('settings/document-updated', (namespace) => {
        if (namespace !== CONTROL_NS) return;
        refreshControl().then(() => compat.refresh()).catch((error) => {
          console.warn(`model-management: could not refresh model visibility settings: ${text(error)}`);
        });
      });
      return () => {
        stop?.();
        compat.dispose();
      };
    }

    function App({ api, remote }) {
      const [state, setState] = react.useState({ groups: [], hidden: [], disabledProviders: [], selection: null, writable: false });
      const [error, setError] = react.useState('');
      const [busy, setBusy] = react.useState('');
      const [collapsedProviders, setCollapsedProviders] = react.useState(null);
      const load = react.useCallback(async () => {
        try {
          setError('');
          const [settingsResponse, modelsResponse] = await Promise.all([api.settings.describe({}), api.llm.models({})]);
          if (!settingsResponse.result.ok) throw new Error(settingsResponse.result.error.message);
          if (!modelsResponse.result.ok) throw new Error(modelsResponse.result.error.message);
          const namespaces = settingsResponse.result.value.namespaces;
          const control = namespaces.find((entry) => entry.ns === CONTROL_NS);
          const defaults = namespaces.find((entry) => entry.ns === DEFAULT_NS);
          const groups = modelsResponse.result.value.groups || [];
          setCollapsedProviders((current) => current === null ? groups.map((group) => group.id) : current.filter((provider) => groups.some((group) => group.id === provider)));
          setState({
            groups,
            hidden: control?.value?.hidden || [],
            disabledProviders: control?.value?.disabledProviders || [],
            selection: defaults?.value ? { provider: defaults.value.provider, model: defaults.value.model, ...(defaults.value.reasoningEffort ? { reasoningEffort: defaults.value.reasoningEffort } : {}) } : null,
            controlRevision: control?.revision,
            defaultRevision: defaults?.revision,
            writable: settingsResponse.result.value.writable === true
          });
        } catch (err) { setError(text(err)); }
      }, [api]);
      react.useEffect(() => { load(); }, [load]);
      react.useEffect(() => {
        const refresh = () => { load(); };
        const subscriptions = [
          remote?.$on?.('settings/document-updated', refresh),
          remote?.$on?.('llm/adapters-updated', refresh)
        ].filter(Boolean);
        return () => subscriptions.forEach((dispose) => dispose());
      }, [load, remote]);

      const updateControl = async (patch) => {
        setBusy('control');
        try {
          const response = await api.settings.mutate({ ns: CONTROL_NS, expectedRevision: state.controlRevision, ops: Object.entries(patch).map(([path, value]) => ({ op: 'set', path: [path], value })) });
          if (!response.result.ok) throw new Error(response.result.error.message);
          await load();
        } catch (err) { setError(text(err)); } finally { setBusy(''); }
      };
      const toggleHidden = (provider, model) => {
        const key = keyOf(provider, model);
        if (state.selection?.provider === provider && state.selection?.model === model) { setError('请先设定其他默认模型，再隐藏当前默认模型。'); return; }
        return updateControl({ hidden: state.hidden.includes(key) ? state.hidden.filter((item) => item !== key) : [...state.hidden, key] });
      };
      const toggleProvider = (provider) => {
        if (state.selection?.provider === provider) { setError('请先设定其他提供方的默认模型，再关闭当前默认模型所在的提供方。'); return; }
        return updateControl({ disabledProviders: state.disabledProviders.includes(provider) ? state.disabledProviders.filter((item) => item !== provider) : [...state.disabledProviders, provider] });
      };
      const toggleCollapsed = (provider) => setCollapsedProviders((current) => (current || []).includes(provider) ? current.filter((item) => item !== provider) : [...(current || []), provider]);
      const setDefault = async (provider, model, reasoning) => {
        setBusy(keyOf(provider, model));
        try {
          const response = await api.settings.replace({ ns: DEFAULT_NS, expectedRevision: state.defaultRevision, section: { provider, model, ...(reasoning?.defaultEffort ? { reasoningEffort: reasoning.defaultEffort } : {}) } });
          if (!response.result.ok) throw new Error(response.result.error.message);
          await load();
        } catch (err) { setError(text(err)); } finally { setBusy(''); }
      };

      return react.createElement('main', { className: 'mm' },
        react.createElement('h2', { className: 'mm-title' }, '模型管理'),
        react.createElement('p', { className: 'mm-intro' }, '模型与 API 密钥请在 DSH 的“模型”页面添加和编辑。'),
        react.createElement('p', { className: 'mm-intro' }, '关闭提供方或隐藏模型会同步更新 DSH 输入框与 /model 的模型选择列表。'),
        error && react.createElement('p', { className: 'mm-error', role: 'alert' }, error),
        state.groups.length === 0 ? react.createElement('p', { className: 'mm-notice' }, '未发现可用模型。请先在“模型”页面完成配置。') : react.createElement('ul', { className: 'mm-rows' }, state.groups.map((group) => {
          const collapsed = (collapsedProviders || []).includes(group.id);
          return react.createElement('li', { className: 'mm-row-card', key: group.id },
          react.createElement('div', { className: 'mm-row-head', role: 'button', tabIndex: 0, 'aria-expanded': !collapsed, 'aria-label': `${collapsed ? '展开' : '收起'} ${group.name || group.id} 的模型列表`, onClick: () => toggleCollapsed(group.id), onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCollapsed(group.id); } } }, react.createElement('span', { className: 'mm-row-name' }, group.name || group.id), react.createElement('div', { className: 'mm-provider-actions' }, react.createElement('button', { type: 'button', className: 'mm-button', disabled: !state.writable || Boolean(busy), onClick: (event) => { event.stopPropagation(); toggleProvider(group.id); } }, state.disabledProviders.includes(group.id) ? '开启提供方' : '关闭提供方'), react.createElement('span', { className: 'mm-button mm-collapse', 'aria-hidden': true }))),
          !collapsed && react.createElement('div', { className: 'mm-models' }, (group.models || []).map((model) => {
            const current = state.selection?.provider === group.id && state.selection?.model === model.id;
            const hidden = state.hidden.includes(keyOf(group.id, model.id));
            const key = keyOf(group.id, model.id);
            return react.createElement('div', { className: 'mm-model', key }, react.createElement('div', { className: 'mm-model-copy' }, react.createElement('span', { className: 'mm-model-name' }, model.name || model.id), react.createElement('span', { className: 'mm-model-id' }, model.id)), current && react.createElement('span', { className: 'mm-state' }, '当前默认'), react.createElement('div', { className: 'mm-actions' }, react.createElement('button', { type: 'button', className: `mm-button${current ? ' primary' : ''}`, disabled: !state.writable || current || Boolean(busy), onClick: () => setDefault(group.id, model.id, model.reasoning) }, current ? '默认模型' : '设为默认'), react.createElement('button', { type: 'button', className: 'mm-button', disabled: !state.writable || Boolean(busy), onClick: () => toggleHidden(group.id, model.id) }, hidden ? '显示' : '隐藏')));
          }))
        );
        })));
    }

    function apply(ctx) {
      const slots = ctx.get('slots'); const connection = ctx.get('connection'); const remote = ctx.get('remote');
      if (!slots || !connection) return;
      ctx.effect(() => installModelSelectionFilter(ctx, connection, remote), 'model-management: model picker compatibility');
      const style = document.createElement('style'); style.textContent = css; document.head.append(style);
      ctx.effect(() => () => style.remove(), 'model-management: styles');
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'model-management', order: 11, label: '模型管理' }, () => react.createElement(App, { api: connection.api, remote })));
    }
    module.exports.apply = apply;
    return module.exports;
  }
});
