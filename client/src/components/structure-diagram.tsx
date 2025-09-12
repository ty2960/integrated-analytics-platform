import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useRef } from "react";

interface StructureDiagramProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StructureDiagram({ isOpen, onClose }: StructureDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && diagramRef.current) {
      // Generate unique ID for this render to avoid collisions
      const uniqueId = `mermaid-diagram-${Date.now()}`;
      
      // Dynamically load Mermaid
      import("mermaid").then(async (mermaid) => {
        try {
          console.log('Initializing Mermaid...');
          
          mermaid.default.initialize({
            theme: 'dark',
            themeVariables: {
              primaryColor: '#3B82F6',
              primaryTextColor: '#E2E8F0',
              primaryBorderColor: '#1E293B',
              lineColor: '#475569',
              secondaryColor: '#1E293B',
              tertiaryColor: '#0F172A',
              background: '#0F172A',
              darkMode: true
            },
            startOnLoad: false,
            securityLevel: 'loose' // Note: Only safe for static content; review if diagram becomes dynamic
          });

          const diagramDefinition = `
graph TD
    BI[BIダッシュボード<br/>KPI可視化・監視] -->|深掘り<br/>コンテキスト引継ぎ| BA[BA作業台<br/>仮説生成・検証]
    BA -->|仮説&前提の登録| MEMO[仮説&前提メモ<br/>検索可能・YAML構造]
    MEMO -->|特徴量・目的変数の合意| PA[PA予測画面<br/>予測+誤差幅+要因分析]
    PA -->|予測結果・リスク評価| DECIDE[意思決定記録<br/>効果・期間・ガードレール]
    DECIDE -->|結果測定・学習| LEARN[学習サイクル<br/>効果検証・モデル改善]
    LEARN -->|検証結果・改善仮説| BA
    LEARN -->|KPI反映・差分可視化| BI
    
    style BI fill:#1E3A8A,stroke:#3B82F6,color:#E2E8F0
    style BA fill:#166534,stroke:#10B981,color:#E2E8F0
    style PA fill:#B45309,stroke:#F59E0B,color:#E2E8F0
    style LEARN fill:#7C2D12,stroke:#EF4444,color:#E2E8F0
    style MEMO fill:#4C1D95,stroke:#8B5CF6,color:#E2E8F0
    style DECIDE fill:#BE185D,stroke:#EC4899,color:#E2E8F0`;
          
          if (diagramRef.current) {
            console.log('Rendering Mermaid diagram...');
            
            // Use the modern render method with unique ID
            const { svg } = await mermaid.default.render(uniqueId, diagramDefinition);
            diagramRef.current.innerHTML = svg;
            
            console.log('Mermaid diagram rendered successfully');
          }
        } catch (error) {
          console.error('Error rendering Mermaid diagram:', error);
          if (diagramRef.current) {
            diagramRef.current.innerHTML = `
              <div class="text-center p-8 border border-gray-600 rounded-lg">
                <h3 class="text-lg font-semibold mb-4">アナリティクス ワークフロー</h3>
                <div class="space-y-2 text-sm">
                  <div>1. BIダッシュボード - KPI可視化・監視</div>
                  <div>2. BA作業台 - 仮説生成・検証</div>
                  <div>3. PA予測 - 予測+誤差幅+要因分析</div>
                  <div>4. 学習サイクル - 効果検証・モデル改善</div>
                </div>
              </div>
            `;
          }
        }
      }).catch((error) => {
        console.error('Error loading Mermaid:', error);
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `
            <div class="text-center p-8 border border-gray-600 rounded-lg">
              <h3 class="text-lg font-semibold mb-4">アナリティクス ワークフロー</h3>
              <div class="space-y-2 text-sm">
                <div>1. BIダッシュボード - KPI可視化・監視</div>
                <div>2. BA作業台 - 仮説生成・検証</div>
                <div>3. PA予測 - 予測+誤差幅+要因分析</div>
                <div>4. 学習サイクル - 効果検証・モデル改善</div>
              </div>
            </div>
          `;
        }
      });
    }

    // Cleanup function to clear diagram on close/unmount
    return () => {
      if (diagramRef.current) {
        diagramRef.current.innerHTML = '';
      }
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>システム構造図</DialogTitle>
        </DialogHeader>
        <div ref={diagramRef} className="text-center p-4" data-testid="mermaid-diagram">
          {/* Mermaid diagram will be rendered here */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
