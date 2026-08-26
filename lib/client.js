window.__ModuleLoader__.load({
  id: '@sharewiner/dsh-model-management',
  factory: (require) => {
    const module = { exports: {} };
    const react = require('react');
    const CONTROL_NS = 'model-management-control';
    const DEFAULT_NS = 'agent-default-model';
    // Client loaders materialize only the declared client entry, so helpers must remain in it.
    const visibility = {
      modelVisibilityKey(provider, model) { return `${provider}/${model}`; },
      filterModelGroups(groups, hidden, disabledProviders, current) {
        const hiddenModels = new Set(hidden || []);
        const disabled = new Set(disabledProviders || []);
        return (groups || []).flatMap((group) => {
          const models = (group.models || []).filter((model) => {
            const selected = current?.provider === group.id && current?.model === model.id;
            return selected || (!disabled.has(group.id) && !hiddenModels.has(`${group.id}/${model.id}`));
          });
          return models.length === 0 ? [] : [{ ...group, models }];
        });
      },
    };
    const directoryCompat = {
      createModelDirectoryCompat({ directories, getControl, onIncompatible = () => {} }) {
        const handleKey = Symbol.for('@sharewiner/dsh-model-management/model-directory-compat');
        if (directories?.[handleKey] !== undefined) return directories[handleKey];
        if (!directories?.live?.directories || typeof directories.live.directories.values !== 'function' || typeof directories.directoryFor !== 'function') {
          onIncompatible('modelDirectories does not expose the supported directory API');
          return { compatible: false, refresh() {}, dispose() {} };
        }
        const wrapped = new Map();
        const rejected = new Set();
        const originalDirectoryFor = directories.directoryFor;
        let disposed = false;
        const wrap = (directory) => {
          if (disposed || wrapped.has(directory)) return wrapped.has(directory);
          const supported = directory !== null && typeof directory === 'object' && typeof directory.load === 'function' && directory.store !== null && typeof directory.store === 'object' && typeof directory.store.update === 'function' && typeof directory.store.getSnapshot === 'function';
          if (!supported) {
            if (!rejected.has(directory)) { rejected.add(directory); onIncompatible('model directory does not expose load() and a mutable snapshot store'); }
            return false;
          }
          const originalLoad = directory.load;
          const wrappedLoad = async function loadWithVisibility() {
            const result = await originalLoad.call(this);
            const supportedResult = result !== null && typeof result === 'object' && Array.isArray(result.groups) && (result.current === null || (typeof result.current === 'object' && result.current !== null));
            if (!supportedResult) { onIncompatible('model directory load() returned an unsupported result'); return result; }
            const control = getControl() || {};
            const hidden = Array.isArray(control.hidden) ? control.hidden : [];
            const disabledProviders = Array.isArray(control.disabledProviders) ? control.disabledProviders : [];
            const groups = visibility.filterModelGroups(result.groups, hidden, disabledProviders, result.current);
            this.store.update((state) => { state.groups = visibility.filterModelGroups(state.groups, hidden, disabledProviders, state.current); });
            return { ...result, groups };
          };
          directory.load = wrappedLoad;
          wrapped.set(directory, { originalLoad, wrappedLoad });
          return true;
        };
        const refresh = () => {
          if (!disposed) for (const directory of directories.live.directories.values()) if (wrap(directory)) directory.load().catch(() => {});
        };
        const wrappedDirectoryFor = function directoryForWithVisibility(sessionId) { const directory = originalDirectoryFor.call(this, sessionId); wrap(directory); return directory; };
        directories.directoryFor = wrappedDirectoryFor;
        refresh();
        const handle = { compatible: true, refresh, dispose() {
          if (disposed) return;
          disposed = true;
          if (directories.directoryFor === wrappedDirectoryFor) directories.directoryFor = originalDirectoryFor;
          for (const [directory, methods] of wrapped) if (directory.load === methods.wrappedLoad) directory.load = methods.originalLoad;
          wrapped.clear();
          delete directories[handleKey];
        } };
        directories[handleKey] = handle;
        return handle;
      },
    };
    const css = `
      .mm{max-width:720px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:8px}.mm-title{margin:0;font-size:16px;font-weight:500;line-height:24px}.mm-intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px}.mm-notice{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.mm-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.mm-rows{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}.mm-row-card{display:flex;flex-direction:column;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}.mm-row-head{display:flex;align-items:center;gap:10px;height:56px;min-height:56px;cursor:pointer}.mm-row-head:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.mm-row-name{font-size:14px;font-weight:500;line-height:22px}.mm-provider-actions{display:flex;align-items:center;gap:10px;margin-left:auto}.mm-switch-field{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}.mm-switch-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%)}.mm-switch{position:relative;box-sizing:border-box;width:38px;min-width:38px;height:22px;padding:0;border:1px solid var(--dsw-alias-label-secondary);border-radius:11px;background:transparent;cursor:pointer;transition:background-color .16s ease,border-color .16s ease}.mm-switch::after{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary);box-shadow:0 1px 3px rgba(0,0,0,.32);content:"";transition:transform .16s ease,background-color .16s ease}.mm-switch[aria-checked=true]{border-color:var(--dsw-alias-state-success-primary,#22c55e);background:var(--dsw-alias-state-success-primary,#22c55e)}.mm-switch[aria-checked=true]::after{background:#fff;transform:translateX(16px)}.mm-switch:focus-visible{outline:2px solid var(--dsw-alias-state-success-primary,#22c55e);outline-offset:2px}.mm-switch:disabled{cursor:default}.mm-switch:disabled::after{opacity:.88}.mm-button.mm-collapse{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;height:24px;padding:0;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary);pointer-events:none}.mm-button.mm-collapse::before{box-sizing:border-box;width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;content:"";transform:rotate(45deg) translate(-2px,-2px)}.mm-row-head[aria-expanded=false] .mm-button.mm-collapse::before{transform:rotate(-45deg) translate(-1px,1px)}.mm-models{display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2);padding-left:20px}.mm-model{box-sizing:border-box;display:flex;align-items:center;gap:10px;height:58px;min-height:58px;padding:0;border-bottom:1px solid var(--dsw-alias-border-l2)}.mm-model:last-child{border-bottom:0}.mm-model-copy{display:flex;flex:1;flex-direction:column;justify-content:center;min-width:0}.mm-model-name{font-size:14px;line-height:20px}.mm-model-id{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.mm-actions{display:flex;align-items:center;flex:none;gap:10px}.mm-button{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:12px/18px inherit;cursor:pointer}.mm-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.mm-button.primary{border-color:var(--dsw-alias-state-success-primary,#22c55e);background:transparent;color:var(--dsw-alias-state-success-primary,#22c55e);font-weight:500}.mm-button.primary::before{width:6px;height:6px;margin-right:6px;border-radius:50%;background:currentColor;content:"";display:inline-block;vertical-align:1px}.mm-button:disabled{opacity:.48;cursor:default}.mm-button.primary:disabled{opacity:1}.mm-state{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}@media(max-width:540px){.mm-models{padding-left:14px}.mm-model{align-items:flex-start;flex-direction:column;height:auto;min-height:76px;padding:8px 0}.mm-actions{width:100%;justify-content:flex-end}.mm-switch-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%)}}
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
          const providerEnabled = !state.disabledProviders.includes(group.id);
          const providerIsDefault = state.selection?.provider === group.id;
          return react.createElement('li', { className: 'mm-row-card', key: group.id },
          react.createElement('div', { className: 'mm-row-head', role: 'button', tabIndex: 0, 'aria-expanded': !collapsed, 'aria-label': `${collapsed ? '展开' : '收起'} ${group.name || group.id} 的模型列表`, onClick: () => toggleCollapsed(group.id), onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCollapsed(group.id); } } }, react.createElement('span', { className: 'mm-row-name' }, group.name || group.id), react.createElement('div', { className: 'mm-provider-actions' }, react.createElement('span', { className: 'mm-switch-field' }, react.createElement('span', { className: 'mm-switch-label' }, '启用提供方'), react.createElement('button', { type: 'button', role: 'switch', className: 'mm-switch', 'aria-checked': providerEnabled, 'aria-label': `${providerEnabled ? '关闭' : '启用'}提供方 ${group.name || group.id}`, disabled: !state.writable || Boolean(busy) || providerIsDefault, onClick: (event) => { event.stopPropagation(); toggleProvider(group.id); } })), react.createElement('span', { className: 'mm-button mm-collapse', 'aria-hidden': true }))),
          !collapsed && react.createElement('div', { className: 'mm-models' }, (group.models || []).map((model) => {
            const current = state.selection?.provider === group.id && state.selection?.model === model.id;
            const hidden = state.hidden.includes(keyOf(group.id, model.id));
            const key = keyOf(group.id, model.id);
            return react.createElement('div', { className: 'mm-model', key }, react.createElement('div', { className: 'mm-model-copy' }, react.createElement('span', { className: 'mm-model-name' }, model.name || model.id), react.createElement('span', { className: 'mm-model-id' }, model.id)), current && react.createElement('span', { className: 'mm-state' }, '当前默认'), react.createElement('div', { className: 'mm-actions' }, react.createElement('button', { type: 'button', className: `mm-button${current ? ' primary' : ''}`, disabled: !state.writable || current || Boolean(busy), onClick: () => setDefault(group.id, model.id, model.reasoning) }, current ? '默认模型' : '设为默认'), react.createElement('span', { className: 'mm-switch-field' }, react.createElement('span', { className: 'mm-switch-label' }, '显示模型'), react.createElement('button', { type: 'button', role: 'switch', className: 'mm-switch', 'aria-checked': !hidden, 'aria-label': `${hidden ? '显示' : '隐藏'}模型 ${model.name || model.id}`, disabled: !state.writable || Boolean(busy) || current, onClick: () => toggleHidden(group.id, model.id) }))));
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
