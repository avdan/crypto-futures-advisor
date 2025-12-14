import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AdvisorAction,
  CreateOrderPlanDraftResponse,
  FuturesOpenOrder,
  FuturesPosition,
  FuturesPositionAnalysisResponse,
  LlmProviderId
} from "@binance-advisor/shared";

import { analyzeFuturesPosition } from "../api/analysis";
import { fetchFuturesOpenOrders, fetchFuturesPositions } from "../api/futures";
import { createOrderPlanDraft } from "../api/orderPlan";
import {
  AccountMarginPanel,
  DeterministicCard,
  LlmProviderCard,
  OpenOrdersTable,
  OrderPlanSection,
  PositionsTable
} from "../components/positions";

type Props = {
  apiBaseUrl: string;
  apiOnline: boolean;
};

export function PositionsView({ apiBaseUrl, apiOnline }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [positions, setPositions] = useState<FuturesPosition[]>([]);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersFetchedAt, setOrdersFetchedAt] = useState<string | null>(null);
  const [orders, setOrders] = useState<FuturesOpenOrder[]>([]);

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FuturesPositionAnalysisResponse | null>(null);
  const [selectedActionKeys, setSelectedActionKeys] = useState<Record<string, boolean>>({});

  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CreateOrderPlanDraftResponse | null>(null);

  const [userContext, setUserContext] = useState<string>("");

  const nonZeroOnly = true;
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshMs = 15_000;

  const refreshPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFuturesPositions(apiBaseUrl, { nonZero: nonZeroOnly });
      setPositions(res.positions);
      setFetchedAt(res.fetchedAt);
    } catch (err) {
      setPositions([]);
      setFetchedAt(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const refreshOrders = useCallback(
    async (symbol: string) => {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const res = await fetchFuturesOpenOrders(apiBaseUrl, symbol);
        setOrders(res.orders);
        setOrdersFetchedAt(res.fetchedAt);
      } catch (err) {
        setOrders([]);
        setOrdersFetchedAt(null);
        setOrdersError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setOrdersLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    void refreshPositions();
  }, [refreshPositions]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void refreshPositions(), refreshMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshPositions]);

  useEffect(() => {
    if (!selectedSymbol) return;
    void refreshOrders(selectedSymbol);
    setAnalysis(null);
    setAnalysisError(null);
    setSelectedActionKeys({});
    setPlan(null);
    setPlanError(null);
  }, [refreshOrders, selectedSymbol]);

  const selectedPosition = useMemo(
    () => positions.find((p) => p.symbol === selectedSymbol) ?? null,
    [positions, selectedSymbol]
  );

  const runAnalysis = useCallback(async () => {
    if (!selectedSymbol) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await analyzeFuturesPosition(apiBaseUrl, {
        symbol: selectedSymbol,
        userContext: userContext.trim() || undefined
      });
      setAnalysis(res);
      setSelectedActionKeys({});
      setPlan(null);
      setPlanError(null);
    } catch (err) {
      setAnalysis(null);
      setAnalysisError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnalysisLoading(false);
    }
  }, [apiBaseUrl, selectedSymbol, userContext]);

  const selectedSelections = useMemo(() => {
    if (!analysis) return [];
    const out: Array<{ provider: LlmProviderId; action: AdvisorAction }> = [];

    for (const provider of analysis.llm.providers) {
      if (!provider.output) continue;
      provider.output.actions.forEach((action, index) => {
        const key = `${provider.provider}:${index}`;
        if (selectedActionKeys[key]) {
          out.push({ provider: provider.provider, action });
        }
      });
    }

    return out;
  }, [analysis, selectedActionKeys]);

  const buildPlan = useCallback(async () => {
    if (!selectedSymbol) return;
    if (selectedSelections.length === 0) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await createOrderPlanDraft(apiBaseUrl, {
        symbol: selectedSymbol,
        selections: selectedSelections
      });
      setPlan(res);
    } catch (err) {
      setPlan(null);
      setPlanError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPlanLoading(false);
    }
  }, [apiBaseUrl, selectedSelections, selectedSymbol]);

  const handleToggleAction = useCallback((key: string, checked: boolean) => {
    setSelectedActionKeys((prev) => ({ ...prev, [key]: checked }));
  }, []);

  // Sort providers: OpenAI first, Claude second
  const sortedProviders = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.llm.providers].sort((a, b) => {
      if (a.provider === "openai") return -1;
      if (b.provider === "openai") return 1;
      return 0;
    });
  }, [analysis]);

  return (
    <section className="card">
      {/* Positions Header */}
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Futures Positions</div>
          <div className="panelSubtitle mono">
            {fetchedAt ? `Fetched: ${fetchedAt}` : "Not fetched yet"}
          </div>
        </div>

        <div className="panelActions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="toggleText mono">Auto refresh (15s)</span>
          </label>

          <button className="button" onClick={() => void refreshPositions()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {!apiOnline ? (
        <div className="warnBox">
          API appears offline. Start `apps/api` and ensure `VITE_API_BASE_URL` is correct.
        </div>
      ) : null}

      {error ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{error}</div>
        </div>
      ) : null}

      {/* Positions Table */}
      <PositionsTable
        positions={positions}
        loading={loading}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      <div className="divider" />

      {/* Open Orders Header */}
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Open Orders</div>
          <div className="panelSubtitle mono">
            {selectedSymbol ? `Symbol: ${selectedSymbol}` : "Select a position"}
            {ordersFetchedAt ? ` - Fetched: ${ordersFetchedAt}` : ""}
          </div>
        </div>

        <div className="panelActions">
          <button
            className="button"
            onClick={() => void runAnalysis()}
            disabled={!selectedSymbol || analysisLoading}
            title="Runs deterministic checks and (optionally) OpenAI analysis"
          >
            {analysisLoading ? "Analyzing..." : "Analyze"}
          </button>
          <button
            className="button"
            onClick={() => selectedSymbol && void refreshOrders(selectedSymbol)}
            disabled={!selectedSymbol || ordersLoading}
          >
            {ordersLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {selectedPosition?.updatedAt ? (
        <div className="hint mono">Position updated: {selectedPosition.updatedAt}</div>
      ) : null}

      {selectedSymbol ? (
        <div className="userContextWrap">
          <label className="userContextLabel" htmlFor="userContext">
            Your notes (optional):
          </label>
          <textarea
            id="userContext"
            className="userContextInput mono"
            placeholder="e.g. Looking to scale out at $100k resistance, watching for 4h close above SMA50..."
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            rows={2}
          />
        </div>
      ) : null}

      {ordersError ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{ordersError}</div>
        </div>
      ) : null}

      {/* Open Orders Table */}
      <OpenOrdersTable orders={orders} loading={ordersLoading} selectedSymbol={selectedSymbol} />

      {/* Account Margin Panel */}
      {analysis?.accountMarginInfo ? <AccountMarginPanel marginInfo={analysis.accountMarginInfo} /> : null}

      <div className="divider" />

      {/* Analysis Header */}
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Analysis</div>
          <div className="panelSubtitle mono">
            {analysis?.fetchedAt ? `Fetched: ${analysis.fetchedAt}` : "Run analysis to see recommendations"}
          </div>
        </div>
      </div>

      {analysisError ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{analysisError}</div>
        </div>
      ) : null}

      {!analysis ? (
        <div className="hint mono">
          This is advisory only. Set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in `apps/api/.env` to enable
          LLM recommendations.
        </div>
      ) : (
        <div className="analysisGrid">
          {/* LLM Providers: OpenAI first, then Claude */}
          {sortedProviders.map((p) => (
            <LlmProviderCard
              key={p.provider}
              provider={p}
              selectedActionKeys={selectedActionKeys}
              onToggleAction={handleToggleAction}
            />
          ))}

          {/* Deterministic last */}
          <DeterministicCard deterministic={analysis.deterministic} />
        </div>
      )}

      {/* Order Plan Section */}
      {analysis ? (
        <OrderPlanSection
          plan={plan}
          planLoading={planLoading}
          planError={planError}
          selectedCount={selectedSelections.length}
          canBuild={Boolean(selectedSymbol) && selectedSelections.length > 0}
          onBuildPlan={() => void buildPlan()}
        />
      ) : null}
    </section>
  );
}
