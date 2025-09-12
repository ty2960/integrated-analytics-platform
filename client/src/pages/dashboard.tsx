import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { storage } from "@/lib/storage";
import type { TabState } from "@/types/analytics";
import BIDashboard from "@/components/bi-dashboard";
import BAWorkshop from "@/components/ba-workshop";
import PAPrediction from "@/components/pa-prediction";
import LearningCycle from "@/components/learning-cycle";
import StructureDiagram from "@/components/structure-diagram";
import RealtimeStatus from "@/components/realtime-status";

export default function Dashboard() {
  const [tabState, setTabState] = useState<TabState>(() => storage.getTabState());
  const [showDiagram, setShowDiagram] = useState(false);

  useEffect(() => {
    storage.setTabState(tabState);
  }, [tabState]);

  const updateTab = (tab: TabState['active_tab']) => {
    setTabState(prev => ({ ...prev, active_tab: tab }));
  };

  const updateFilterState = (filterState: TabState['filter_state']) => {
    setTabState(prev => ({ ...prev, filter_state: filterState }));
  };

  const tabs = [
    { id: 'bi', label: 'BI ダッシュボード', testId: 'tab-bi' },
    { id: 'ba', label: 'BA 作業台', testId: 'tab-ba' },
    { id: 'pa', label: 'PA 予測', testId: 'tab-pa' },
    { id: 'learn', label: '学習サイクル', testId: 'tab-learn' },
    { id: 'realtime', label: 'リアルタイム監視', testId: 'tab-realtime' },
  ] as const;

  return (
    <div className="min-h-screen gradient-bg text-foreground">
      {/* Header */}
      <header className="glass-effect border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                統合アナリティクス
              </h1>
              <Badge variant="secondary" className="text-xs">
                v1.0-demo
              </Badge>
            </div>
            
            {/* Tab Navigation */}
            <nav className="flex space-x-1 bg-muted p-1 rounded-lg">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  data-testid={tab.testId}
                  variant="ghost"
                  size="sm"
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    tabState.active_tab === tab.id 
                      ? 'tab-active' 
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                  onClick={() => updateTab(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </nav>

            <Button
              data-testid="button-structure-diagram"
              variant="outline"
              size="sm"
              onClick={() => setShowDiagram(true)}
              className="px-4 py-2 text-sm font-medium"
            >
              構造図
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {tabState.active_tab === 'bi' && (
          <BIDashboard 
            filterState={tabState.filter_state}
            onFilterChange={updateFilterState}
            onDeepDive={() => updateTab('ba')}
          />
        )}
        
        {tabState.active_tab === 'ba' && (
          <BAWorkshop 
            filterState={tabState.filter_state}
            onPredictionRequest={(hypothesisId) => {
              setTabState(prev => ({ 
                ...prev, 
                active_tab: 'pa',
                selected_hypothesis_id: hypothesisId,
                prediction_context: {
                  hypothesis_id: hypothesisId,
                  target_metric: 'CVR'
                }
              }));
            }}
          />
        )}
        
        {tabState.active_tab === 'pa' && (
          <PAPrediction 
            filterState={tabState.filter_state}
            hypothesisId={tabState.selected_hypothesis_id}
            predictionContext={tabState.prediction_context}
            onDecisionRecorded={() => updateTab('learn')}
          />
        )}
        
        {tabState.active_tab === 'learn' && (
          <LearningCycle 
            onBIReflection={() => updateTab('bi')}
            onNewHypothesis={() => updateTab('ba')}
          />
        )}
        
        {tabState.active_tab === 'realtime' && (
          <RealtimeStatus />
        )}
      </main>

      {/* Structure Diagram Modal */}
      <StructureDiagram 
        isOpen={showDiagram}
        onClose={() => setShowDiagram(false)}
      />
    </div>
  );
}
