/** Immutable edits on a scan's group tree, addressed by node id. */
import { cloneWithNewIds, type Group, type ScanNode } from "./scan-types";

export function updateNode(root: Group, id: string, update: (node: ScanNode) => ScanNode): Group {
  if (root.id === id) return update(root) as Group;
  let changed = false;
  const items = root.items.map((item) => {
    if (item.id === id) {
      changed = true;
      return update(item);
    }
    if (item.kind === "group") {
      const next = updateNode(item, id, update);
      if (next !== item) changed = true;
      return next;
    }
    return item;
  });
  return changed ? { ...root, items } : root;
}

export function removeNode(root: Group, id: string): Group {
  let changed = false;
  const items: ScanNode[] = [];
  for (const item of root.items) {
    if (item.id === id) {
      changed = true;
      continue;
    }
    if (item.kind === "group") {
      const next = removeNode(item, id);
      if (next !== item) changed = true;
      items.push(next);
    } else {
      items.push(item);
    }
  }
  return changed ? { ...root, items } : root;
}

export function appendToGroup(root: Group, groupId: string, nodes: readonly ScanNode[]): Group {
  return updateNode(root, groupId, (node) =>
    node.kind === "group" ? { ...node, items: [...node.items, ...nodes] } : node,
  );
}

export function duplicateNode(root: Group, id: string): Group {
  const walk = (group: Group): Group => {
    const index = group.items.findIndex((item) => item.id === id);
    if (index >= 0) {
      const items = [...group.items];
      items.splice(index + 1, 0, cloneWithNewIds(group.items[index]!));
      return { ...group, items };
    }
    return {
      ...group,
      items: group.items.map((item) => (item.kind === "group" ? walk(item) : item)),
    };
  };
  return walk(root);
}

export function moveNode(root: Group, id: string, direction: -1 | 1): Group {
  const walk = (group: Group): Group => {
    const index = group.items.findIndex((item) => item.id === id);
    if (index >= 0) {
      const target = index + direction;
      if (target < 0 || target >= group.items.length) return group;
      const items = [...group.items];
      [items[index], items[target]] = [items[target]!, items[index]!];
      return { ...group, items };
    }
    return {
      ...group,
      items: group.items.map((item) => (item.kind === "group" ? walk(item) : item)),
    };
  };
  return walk(root);
}

export function countFilters(group: Group): number {
  return group.items.reduce((total, item) => total + (item.kind === "group" ? countFilters(item) : 1), 0);
}
