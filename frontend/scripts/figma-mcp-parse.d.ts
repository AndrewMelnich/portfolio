export type FigmaNode = {
    type: string;
    id?: string;
    name?: string;
    layout?: string | Record<string, unknown>;
    fills?: unknown;
    opacity?: number;
    textStyle?: string;
    text?: string;
    template?: string;
    borderRadius?: string;
    children?: FigmaNode[];
    [key: string]: unknown;
};

export type FigmaFrame = {
    nodeId: string;
    url: string;
    name: string | null;
    designedWidth?: number;
    designedHeight?: number;
    globalVars: Record<string, unknown>;
    elements?: Record<string, unknown>;
    tree: FigmaNode;
};

export type FigmaSnapshot = {
    fileKey: string | null;
    fileName: string | null;
    fetchedAt: string | null;
    source: string;
    frames: Record<string, FigmaFrame>;
};

export type CheckResolveOk = { ok: true; value: unknown; frameKey: string };
export type CheckResolveFail = { ok: false; reason: string };
export type CheckResolveResult = CheckResolveOk | CheckResolveFail;

export function parseMcpDump(mcpText: string): FigmaSnapshot;
export function snapshotToYaml(snapshot: FigmaSnapshot): string;
export function resolveCheckFrom(snapshot: FigmaSnapshot, fromPath: string): CheckResolveResult;
export function validateCheckDoc(
    checkDoc: Record<string, unknown>,
    snapshot: FigmaSnapshot,
): { ok: boolean; errors: string[] };
export function parseNodeLine(line: string): FigmaNode;
export function parseAttrs(s: string): Record<string, unknown>;
