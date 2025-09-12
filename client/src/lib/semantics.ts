import { storage } from './storage';
import type { FilterState, KPIData, TimeSeriesData, SegmentData } from '@/types/analytics';

export class SemanticLayer {
  // Common KPI calculations with consistent definitions across BI/BA/PA

  calculateKPIs(filter: FilterState): KPIData {
    const orders = this.getFilteredOrders(filter);
    const customers = storage.getDimCustomers();
    
    // Current period calculations
    const revenue = orders.reduce((sum, order) => sum + order.revenue, 0);
    const uniqueCustomers = new Set(orders.map(o => o.customer_id)).size;
    const aov = uniqueCustomers > 0 ? revenue / orders.length : 0;

    // New customers calculation
    const newCustomers = this.calculateNewCustomers(filter);
    
    // Retention D30 calculation (simplified cohort analysis)
    const retentionD30 = this.calculateRetentionD30(filter);

    // Previous period for comparison
    const previousFilter = this.getPreviousFilterPeriod(filter);
    const previousOrders = this.getFilteredOrders(previousFilter);
    const previousRevenue = previousOrders.reduce((sum, order) => sum + order.revenue, 0);
    const previousUniqueCustomers = new Set(previousOrders.map(o => o.customer_id)).size;
    const previousAOV = previousUniqueCustomers > 0 ? previousRevenue / previousOrders.length : 0;
    const previousNewCustomers = this.calculateNewCustomers(previousFilter);
    const previousRetention = this.calculateRetentionD30(previousFilter);

    return {
      revenue,
      retention_d30: retentionD30,
      aov,
      new_customers: newCustomers,
      revenue_change: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0,
      retention_change: previousRetention > 0 ? ((retentionD30 - previousRetention) / previousRetention) * 100 : 0,
      aov_change: previousAOV > 0 ? ((aov - previousAOV) / previousAOV) * 100 : 0,
      new_customers_change: previousNewCustomers > 0 ? ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100 : 0,
    };
  }

  getTimeSeriesData(filter: FilterState): TimeSeriesData[] {
    const orders = this.getFilteredOrders(filter);
    const customers = storage.getDimCustomers();
    
    // Group by date
    const dailyData = new Map<string, { revenue: number; customerIds: Set<string> }>();
    
    orders.forEach(order => {
      const date = order.order_ts.split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, { revenue: 0, customerIds: new Set() });
      }
      const dayData = dailyData.get(date)!;
      dayData.revenue += order.revenue;
      
      // Check if customer is new (first order within period)
      const customer = customers.find(c => c.customer_id === order.customer_id);
      if (customer && this.isNewCustomer(customer, order.order_ts)) {
        dayData.customerIds.add(order.customer_id);
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        new_customers: data.customerIds.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getSegmentData(filter: FilterState): SegmentData[] {
    const orders = this.getFilteredOrders(filter);
    const customers = storage.getDimCustomers();
    
    const segments = ['Premium', 'Standard', 'Basic'] as const;
    
    return segments.map(segment => {
      const segmentCustomers = customers.filter(c => c.segment === segment);
      const segmentCustomerIds = new Set(segmentCustomers.map(c => c.customer_id));
      const segmentOrders = orders.filter(o => segmentCustomerIds.has(o.customer_id));
      
      const revenue = segmentOrders.reduce((sum, order) => sum + order.revenue, 0);
      const uniqueCustomers = new Set(segmentOrders.map(o => o.customer_id)).size;
      const aov = segmentOrders.length > 0 ? revenue / segmentOrders.length : 0;
      
      // Simplified conversion rate calculation
      const conversionRate = uniqueCustomers > 0 ? (segmentOrders.length / uniqueCustomers) : 0;
      
      // Previous period comparison
      const previousFilter = this.getPreviousFilterPeriod(filter);
      const previousSegmentOrders = this.getFilteredOrders(previousFilter)
        .filter(o => segmentCustomerIds.has(o.customer_id));
      const previousRevenue = previousSegmentOrders.reduce((sum, order) => sum + order.revenue, 0);
      const revenueChange = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0;

      return {
        segment,
        revenue,
        revenue_change: revenueChange,
        aov,
        conversion_rate: conversionRate * 100, // Convert to percentage
      };
    });
  }

  private getFilteredOrders(filter: FilterState) {
    const orders = storage.getFactOrders();
    const customers = storage.getDimCustomers();
    
    // Date filtering
    const periodDays = filter.period === '30days' ? 30 : filter.period === '60days' ? 60 : 90;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - periodDays);
    
    return orders.filter(order => {
      const orderDate = new Date(order.order_ts);
      
      // Date range filter
      if (orderDate < startDate || orderDate > endDate) return false;
      
      // Channel filter
      if (filter.channel !== 'All' && order.channel !== filter.channel) return false;
      
      // Segment filter
      if (filter.segment !== 'All') {
        const customer = customers.find(c => c.customer_id === order.customer_id);
        if (!customer || customer.segment !== filter.segment) return false;
      }
      
      return true;
    });
  }

  private getPreviousFilterPeriod(filter: FilterState): FilterState {
    // Return filter for previous equivalent period
    return { ...filter };
  }

  private calculateNewCustomers(filter: FilterState): number {
    const orders = this.getFilteredOrders(filter);
    const customers = storage.getDimCustomers();
    
    const newCustomerIds = new Set<string>();
    
    orders.forEach(order => {
      const customer = customers.find(c => c.customer_id === order.customer_id);
      if (customer && this.isNewCustomer(customer, order.order_ts)) {
        newCustomerIds.add(customer.customer_id);
      }
    });
    
    return newCustomerIds.size;
  }

  private calculateRetentionD30(filter: FilterState): number {
    // Simplified retention calculation
    // In a real implementation, this would track D0 cohorts and their D30 survival
    const customers = storage.getDimCustomers();
    const activeCustomers = customers.filter(c => c.lifecycle_stage === 'Active').length;
    const totalCustomers = customers.length;
    
    return totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;
  }

  private isNewCustomer(customer: any, orderDate: string): boolean {
    const customerCreated = new Date(customer.created_at);
    const orderTime = new Date(orderDate);
    const daysDiff = (orderTime.getTime() - customerCreated.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysDiff <= 30; // Consider "new" if created within 30 days of order
  }
}

export const semantics = new SemanticLayer();
