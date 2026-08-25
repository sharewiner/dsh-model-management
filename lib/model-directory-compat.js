import { filterModelGroups } from './model-visibility.js';

const COMPAT_HANDLE = Symbol.for('@sharewiner/dsh-model-management/model-directory-compat');

function isDirectory(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.load === 'function'
    && value.store !== null
    && typeof value.store === 'object'
    && typeof value.store.update === 'function'
    && typeof value.store.getSnapshot === 'function';
}

function isModelDirectoryResult(value) {
  return value !== null
    && typeof value === 'object'
    && Array.isArray(value.groups)
    && (value.current === null || (typeof value.current === 'object' && value.current !== null));
}

function normalizeControl(value) {
  return {
    hidden: Array.isArray(value?.hidden) ? value.hidden : [],
    disabledProviders: Array.isArray(value?.disabledProviders) ? value.disabledProviders : [],
  };
}

export function createModelDirectoryCompat({ directories, getControl, onIncompatible = () => {} }) {
  if (directories?.[COMPAT_HANDLE] !== undefined) return directories[COMPAT_HANDLE];
  if (!directories?.live?.directories || typeof directories.live.directories.values !== 'function') {
    onIncompatible('modelDirectories.live.directories is unavailable');
    return { compatible: false, refresh() {}, dispose() {} };
  }

  const wrapped = new Map();
  const rejected = new WeakSet();
  const originalDirectoryFor = typeof directories.directoryFor === 'function' ? directories.directoryFor : undefined;
  let disposed = false;

  const wrap = (directory) => {
    if (disposed || wrapped.has(directory)) return wrapped.has(directory);
    if (!isDirectory(directory)) {
      if (!rejected.has(directory)) {
        rejected.add(directory);
        onIncompatible('model directory does not expose load() and a mutable snapshot store');
      }
      return false;
    }

    const originalLoad = directory.load;
    directory.load = async function loadWithVisibility() {
      const result = await originalLoad.call(this);
      if (!isModelDirectoryResult(result)) {
        onIncompatible('model directory load() returned an unsupported result');
        return result;
      }

      const control = normalizeControl(getControl());
      const groups = filterModelGroups(result.groups, control.hidden, control.disabledProviders, result.current);
      this.store.update((state) => {
        state.groups = filterModelGroups(state.groups, control.hidden, control.disabledProviders, state.current);
      });
      return { ...result, groups };
    };
    wrapped.set(directory, originalLoad);
    return true;
  };

  const refresh = () => {
    if (disposed) return;
    for (const directory of directories.live.directories.values()) {
      if (wrap(directory)) directory.load().catch(() => {});
    }
  };

  if (originalDirectoryFor === undefined) {
    onIncompatible('modelDirectories.directoryFor() is unavailable');
    return { compatible: false, refresh() {}, dispose() {} };
  }

  directories.directoryFor = function directoryForWithVisibility(sessionId) {
    const directory = originalDirectoryFor.call(this, sessionId);
    wrap(directory);
    return directory;
  };

  refresh();
  const handle = {
    compatible: true,
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (directories.directoryFor !== originalDirectoryFor) directories.directoryFor = originalDirectoryFor;
      for (const [directory, originalLoad] of wrapped) {
        if (directory.load !== originalLoad) directory.load = originalLoad;
      }
      wrapped.clear();
      delete directories[COMPAT_HANDLE];
    },
  };
  directories[COMPAT_HANDLE] = handle;
  return handle;
}
