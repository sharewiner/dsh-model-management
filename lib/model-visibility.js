export function modelVisibilityKey(provider, model) {
  return `${provider}/${model}`;
}

export function filterModelGroups(groups, hidden, disabledProviders, current) {
  const hiddenModels = new Set(hidden || []);
  const disabled = new Set(disabledProviders || []);

  return (groups || []).flatMap((group) => {
    const models = (group.models || []).filter((model) => {
      const selected = current?.provider === group.id && current?.model === model.id;
      return selected || (!disabled.has(group.id) && !hiddenModels.has(modelVisibilityKey(group.id, model.id)));
    });

    return models.length === 0 ? [] : [{ ...group, models }];
  });
}
