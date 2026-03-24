import { useCallback, useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import { Loader2, RefreshCw, Sparkles, Network } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trpc } from "@/api/trpc";

cytoscape.use(coseBilkent);

const NODE_COLORS: Record<string, string> = {
  biomarker: "#3b82f6",
  condition: "#f59e0b",
  lifestyle: "#22c55e",
  environmental: "#06b6d4",
  symptom: "#8b5cf6",
  medication: "#ec4899",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  biomarker: "Biomarker",
  condition: "Condition",
  lifestyle: "Lifestyle",
  environmental: "Environmental",
  symptom: "Symptom",
  medication: "Medication",
};

type GraphNode = {
  id: string;
  nodeType: string;
  label: string;
  metadata: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  weight: number;
};

type SelectedNode = GraphNode & {
  connectedEdges: Array<{ label: string; target: string; weight: number }>;
};

type SheetMode = { kind: "node"; node: SelectedNode } | { kind: "narrative" };

function CytoscapeCanvas({
  nodes,
  edges,
  onNodeSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (node: SelectedNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.label,
            nodeType: n.nodeType,
            color: NODE_COLORS[n.nodeType] ?? "#6366f1",
          },
        })),
        ...edges.map((e) => ({
          data: {
            id: e.id,
            source: e.sourceId,
            target: e.targetId,
            label: e.relationship.replace(/_/g, " "),
            weight: e.weight,
            lineColor:
              e.weight >= 0.6
                ? "#3b82f6"
                : e.weight <= -0.3
                  ? "#f59e0b"
                  : "#475569",
            lineWidth: Math.max(1, Math.abs(e.weight) * 6),
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            "font-size": 11,
            "font-family": "system-ui, sans-serif",
            "text-valign": "bottom" as const,
            "text-halign": "center" as const,
            "text-margin-y": 5,
            color: "#e2e8f0",
            "text-outline-color": "#0f172a",
            "text-outline-width": 2,
            width: 38,
            height: 38,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#fff",
            "border-opacity": 1,
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(lineWidth)",
            "line-color": "data(lineColor)",
            "curve-style": "bezier" as const,
            "target-arrow-shape": "triangle" as const,
            "target-arrow-color": "data(lineColor)",
            "arrow-scale": 0.8,
            opacity: 0.7,
          },
        },
        {
          selector: "edge:selected",
          style: {
            opacity: 1,
            label: "data(label)",
            "font-size": 9,
            color: "#94a3b8",
            "text-outline-width": 0,
          },
        },
      ],
      layout: {
        name: "cose-bilkent",
        animate: false,
        animationDuration: 0,
        nodeRepulsion: 8000,
        idealEdgeLength: 120,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.3,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 3.8,
        padding: 40,
      } as cytoscape.LayoutOptions,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.2,
      maxZoom: 4,
    });

    cy.on("tap", "node", (evt) => {
      const node = evt.target as cytoscape.NodeSingular;
      const nodeData = nodes.find((n) => n.id === node.id());
      if (!nodeData) return;

      const nodeEdges = edges
        .filter((e) => e.sourceId === node.id() || e.targetId === node.id())
        .map((e) => {
          const isSource = e.sourceId === node.id();
          const otherId = isSource ? e.targetId : e.sourceId;
          const other = nodes.find((n) => n.id === otherId);
          return {
            label: `${e.relationship.replace(/_/g, " ")}${isSource ? " →" : " ←"}`,
            target: other?.label ?? otherId,
            weight: e.weight,
          };
        });

      onNodeSelect({ ...nodeData, connectedEdges: nodeEdges });
    });

    return () => {
      cy.destroy();
    };
  }, [nodes, edges, onNodeSelect]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function NodeSheetContent({ node }: { node: SelectedNode }) {
  const color = NODE_COLORS[node.nodeType] ?? "#6366f1";
  const meta = node.metadata as Record<string, string | number | boolean>;

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}
          </span>
        </div>
        <SheetTitle>{node.label}</SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-5 overflow-y-auto flex-1">
        {Object.keys(meta).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Properties</p>
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">
                  {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                </span>
                <span className="font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {node.connectedEdges.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Connections ({node.connectedEdges.length})
            </p>
            {node.connectedEdges.map((edge, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      edge.weight >= 0.6
                        ? "#22c55e"
                        : edge.weight <= -0.3
                          ? "#ef4444"
                          : "#64748b",
                  }}
                />
                <span className="text-muted-foreground truncate flex-1">{edge.label}</span>
                <span className="font-medium truncate max-w-28">{edge.target}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NarrativeSheetContent() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.graph.getNarrative.useQuery();
  const generate = trpc.graph.generateNarrative.useMutation({
    onSuccess: () => utils.graph.getNarrative.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const narrative = data?.narrative;

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <SheetTitle>AI Health Summary</SheetTitle>
        </div>
      </SheetHeader>

      <div className="mt-4 flex flex-col gap-4 flex-1 overflow-y-auto">
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="self-start"
        >
          {generate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
          {narrative ? "Regenerate" : "Generate summary"}
        </Button>

        {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}

        {!isLoading && !narrative && !generate.isPending && (
          <p className="text-sm text-muted-foreground">
            Click Generate to have Claude analyse your cross-domain correlations and produce a personalised health narrative.
          </p>
        )}

        {generate.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Claude is analysing your data…
          </div>
        )}

        {narrative && !generate.isPending && (
          <div className="prose prose-sm prose-invert max-w-none text-muted-foreground [&>*:first-child]:mt-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
          </div>
        )}
      </div>
    </>
  );
}

export function GraphTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.graph.list.useQuery();
  const rebuild = trpc.graph.rebuild.useMutation({
    onSuccess: (res) => {
      utils.graph.list.invalidate();
      utils.graph.getNarrative.invalidate();
      toast.success(`Graph rebuilt: ${res.nodeCount} nodes, ${res.edgeCount} edges`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);

  const handleNodeSelect = useCallback((node: SelectedNode) => {
    setSheetMode({ kind: "node", node });
  }, []);

  type RawListData = {
    nodes: Array<{ id: string; nodeType: string; label: string; metadata: unknown; reportId: string | null; conditionId: string | null }>;
    edges: Array<{ id: string; sourceId: string; targetId: string; relationship: string; weight: number }>;
  };
  const raw = data as unknown as RawListData | undefined;

  const nodes: GraphNode[] = (raw?.nodes ?? []).map((n) => ({
    id: n.id,
    nodeType: n.nodeType,
    label: n.label,
    metadata: (n.metadata as Record<string, unknown>) ?? {},
  }));

  const edges: GraphEdge[] = (raw?.edges ?? []).map((e) => ({
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    relationship: e.relationship,
    weight: e.weight,
  }));

  const isEmpty = !isLoading && nodes.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Knowledge Graph</h2>
          {nodes.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {nodes.length} nodes · {edges.length} edges
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(NODE_TYPE_LABELS)
            .filter(([type]) => nodes.some((n) => n.nodeType === type))
            .map(([type, label]) => (
              <div key={type} className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NODE_COLORS[type] }} />
                {label}
              </div>
            ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSheetMode({ kind: "narrative" })}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Summary
          </Button>
          <Button
            size="sm"
            onClick={() => rebuild.mutate()}
            disabled={rebuild.isPending}
          >
            {rebuild.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {rebuild.isPending ? "Building..." : "Rebuild"}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#0a0f1a]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <Network className="h-16 w-16 text-muted-foreground/30" />
            <div>
              <p className="text-muted-foreground font-medium">No graph data yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Click Rebuild to generate the knowledge graph from your reports and conditions.
              </p>
            </div>
            <Button onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
              {rebuild.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {rebuild.isPending ? "Building..." : "Build Graph"}
            </Button>
          </div>
        )}

        {!isLoading && nodes.length > 0 && (
          <CytoscapeCanvas
            nodes={nodes}
            edges={edges}
            onNodeSelect={handleNodeSelect}
          />
        )}

        {rebuild.isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Claude is analyzing your health data...
            </p>
          </div>
        )}
      </div>

      <Sheet open={sheetMode !== null} onOpenChange={(open) => { if (!open) setSheetMode(null); }}>
        <SheetContent className="flex flex-col p-0 gap-0 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto p-6 gap-4">
            {sheetMode?.kind === "node" && <NodeSheetContent node={sheetMode.node} />}
            {sheetMode?.kind === "narrative" && <NarrativeSheetContent />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
