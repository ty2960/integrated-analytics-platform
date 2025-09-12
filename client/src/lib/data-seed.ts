import { storage } from './storage';
import type { FactOrder, DimCustomer, DimProduct, AnalyticsHypothesis } from '@/types/analytics';

export function seedMockData(): void {
  if (storage.isDataInitialized()) {
    return;
  }

  // Generate customers
  const customers: DimCustomer[] = [];
  const segments = ['Premium', 'Standard', 'Basic'] as const;
  const stages = ['New', 'Active', 'At Risk', 'Churned'] as const;
  const regions = ['Tokyo', 'Osaka', 'Nagoya', 'Fukuoka', 'Sapporo'];

  for (let i = 1; i <= 1000; i++) {
    customers.push({
      customer_id: `CUST-${String(i).padStart(4, '0')}`,
      segment: segments[Math.floor(Math.random() * segments.length)],
      lifecycle_stage: stages[Math.floor(Math.random() * stages.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      created_at: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
    });
  }

  // Generate products
  const products: DimProduct[] = [];
  const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Beauty'];
  const priceBands = ['Low', 'Medium', 'High'] as const;

  for (let i = 1; i <= 200; i++) {
    const priceBand = priceBands[Math.floor(Math.random() * priceBands.length)];
    let price = 0;
    switch (priceBand) {
      case 'Low': price = Math.floor(Math.random() * 2000) + 500; break;
      case 'Medium': price = Math.floor(Math.random() * 5000) + 2000; break;
      case 'High': price = Math.floor(Math.random() * 10000) + 7000; break;
    }

    products.push({
      product_id: `PROD-${String(i).padStart(3, '0')}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      price_band: priceBand,
      price,
    });
  }

  // Generate orders for past 90 days
  const orders: FactOrder[] = [];
  const channels = ['EC', 'Store', 'App'] as const;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 90);

  let orderId = 1;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Generate 20-60 orders per day with weekly seasonality
    const dayOfWeek = d.getDay();
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1.0;
    const baseOrders = 30 + Math.floor(Math.random() * 30);
    const dailyOrders = Math.floor(baseOrders * weekendMultiplier);

    for (let i = 0; i < dailyOrders; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const channel = channels[Math.floor(Math.random() * channels.length)];
      
      // Add some segment-based purchasing patterns
      let priceMultiplier = 1.0;
      if (customer.segment === 'Premium') priceMultiplier = 1.5;
      if (customer.segment === 'Basic') priceMultiplier = 0.7;

      orders.push({
        order_id: `ORD-${String(orderId++).padStart(6, '0')}`,
        customer_id: customer.customer_id,
        product_id: product.product_id,
        order_ts: new Date(d.getTime() + Math.random() * 86400000).toISOString(),
        revenue: Math.floor(product.price * priceMultiplier * (0.8 + Math.random() * 0.4)),
        channel,
      });
    }
  }

  // Generate sample hypotheses
  const hypotheses: AnalyticsHypothesis[] = [
    {
      hypothesis_id: 'HYP-2025-01-02-001',
      title: '新規顧客の初回割引はCVRを押し上げるがLTVは低下しないか',
      text: '新規顧客に対する初回20%割引施策がコンバージョン率向上に与える効果を検証する。',
      assumptions: [
        '価格帯2,000〜3,000円で弾性低',
        '低フリクション導線ではCVR弾性が高い',
        '既存の割引施策と競合しない'
      ],
      owner: 'マーケティングチーム',
      tags: ['CVR改善', '新規獲得', '割引施策'],
      created_at: '2025-01-02T09:00:00Z',
      metrics: {
        target: '初回CVR',
        guardrail: ['30日LTV >= 2,800円', '返金率 <= 3%']
      },
      data_scope: '2025Q1 / ECチャネル'
    },
    {
      hypothesis_id: 'HYP-2024-12-28-003',
      title: 'プレミアム顧客のアップセル施策効果測定',
      text: 'プレミアム会員に対する高額商品のアップセル施策の効果を測定する。',
      assumptions: [
        '既存顧客の満足度が高い状態',
        'カテゴリ別の購買パターンに一貫性がある',
        'アップセル商品の品質が担保されている'
      ],
      owner: 'セールスチーム',
      tags: ['アップセル', 'プレミアム', 'AOV向上'],
      created_at: '2024-12-28T14:30:00Z',
      metrics: {
        target: 'AOV 15%向上',
        guardrail: ['チャーン率 <= 5%', '顧客満足度 >= 4.0']
      },
      data_scope: '2025Q1 / 全チャネル'
    }
  ];

  // Save all data
  storage.setDimCustomers(customers);
  storage.setDimProducts(products);
  storage.setFactOrders(orders);
  storage.setHypotheses(hypotheses);
  storage.setDataInitialized();

  console.log('Mock data seeded successfully');
  console.log(`Generated: ${customers.length} customers, ${products.length} products, ${orders.length} orders`);
}
