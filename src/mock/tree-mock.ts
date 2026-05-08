import type { TreeResponse, TreeNode, TreeRoot, NodeResponse } from "@/types";

const MOCK_IMAGE = "/XZZD15557_2_v0.jpg";

function createTreeNode(
  selfId: string,
  parentId: string,
  rootId: string,
  score: number,
  children: TreeNode[] = [],
): TreeNode {
  return {
    id: selfId,
    selfId,
    selfUrl: MOCK_IMAGE,
    parentId,
    parentUrl: parentId ? MOCK_IMAGE : "",
    rootId,
    rootUrl: MOCK_IMAGE,
    matchDate: "2026-04-29",
    score,
    children,
    manualReview: "",
    reviewResult: "",
    intelligentRecommend: "",
  };
}

const tree1: TreeNode = createTreeNode("A-001", "", "A-001", 1.0, [
  createTreeNode("A-002", "A-001", "A-001", 0.95, [
    createTreeNode("A-004", "A-002", "A-001", 0.88),
    createTreeNode("A-005", "A-002", "A-001", 0.76),
  ]),
  createTreeNode("A-003", "A-001", "A-001", 0.82, [
    createTreeNode("A-006", "A-003", "A-001", 0.71),
    createTreeNode("A-007", "A-003", "A-001", 0.65),
    createTreeNode("A-008", "A-003", "A-001", 0.59),
  ]),
]);

const tree2: TreeNode = createTreeNode("B-001", "", "B-001", 1.0, [
  createTreeNode("B-002", "B-001", "B-001", 0.91, [
    createTreeNode("B-004", "B-002", "B-001", 0.83),
    createTreeNode("B-005", "B-002", "B-001", 0.77),
  ]),
  createTreeNode("B-003", "B-001", "B-001", 0.68),
]);

const tree3: TreeNode = createTreeNode("C-001", "", "C-001", 1.0, [
  createTreeNode("C-002", "C-001", "C-001", 0.93, [
    createTreeNode("C-005", "C-002", "C-001", 0.85, [
      createTreeNode("C-008", "C-005", "C-001", 0.72),
    ]),
    createTreeNode("C-006", "C-002", "C-001", 0.79),
  ]),
  createTreeNode("C-003", "C-001", "C-001", 0.86, [
    createTreeNode("C-007", "C-003", "C-001", 0.74),
  ]),
  createTreeNode("C-004", "C-001", "C-001", 0.62),
]);

const mockTreesMap: Record<string, TreeNode> = {
  "A-001": tree1,
  "B-001": tree2,
  "C-001": tree3,
};

const mockRootIds: TreeRoot[] = [
  { rootId: "A-001", rootUrl: MOCK_IMAGE, treeName: "SXT135", maxMatchDate: "2026-04-29" },
  { rootId: "B-001", rootUrl: MOCK_IMAGE, treeName: "SXT136", maxMatchDate: "2026-04-28" },
  { rootId: "C-001", rootUrl: MOCK_IMAGE, treeName: "", maxMatchDate: "2026-04-27" },
];

export function getMockAllRootIds(): Promise<TreeResponse> {
  return Promise.resolve({
    success: true,
    count: mockRootIds.length,
    roots: mockRootIds,
  });
}

export function mockUpdateRootName(rootId: string, name: string): Promise<{ success: boolean }> {
  const root = mockRootIds.find((r) => r.rootId === rootId)
  if (root) {
    root.treeName = name
  }
  return Promise.resolve({ success: true })
}

export function getMockTreeByRootId(rootId: string): Promise<NodeResponse> {
  const treeNode = mockTreesMap[rootId];
  const root = mockRootIds.find((r) => r.rootId === rootId);
  return Promise.resolve({
    success: true,
    tree: {
      rootId,
      rootUrl: root?.rootUrl || MOCK_IMAGE,
      tree: treeNode,
      treeName: root?.treeName || "",
      maxMatchDate: root?.maxMatchDate || "",
    },
  });
}
