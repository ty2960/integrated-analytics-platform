# Overview

This is an integrated analytics demo application that showcases BI (Business Intelligence), BA (Business Analytics), and PA (Predictive Analytics) capabilities in a single web interface. The application provides a comprehensive analytics workflow where users can visualize KPIs, conduct deep analysis with hypothesis tracking, make predictions, and monitor decision outcomes through a learning cycle.

The demo uses mock data generated locally and operates entirely in the browser using localStorage for persistence, making it a self-contained analytics platform that requires no external dependencies or server infrastructure.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, built using Vite for fast development and building
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with custom design tokens and dark theme support
- **State Management**: React hooks for local state, React Query for data fetching patterns
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Chart.js for data visualization and Mermaid for system diagrams

## Backend Architecture
- **Server**: Express.js with TypeScript for API endpoints (minimal implementation)
- **Development**: Vite dev server with HMR (Hot Module Replacement) support
- **Build**: ESBuild for server bundling, Vite for client bundling
- **Static Assets**: Served through Vite in development, built to dist/public for production

## Data Storage Solutions
- **Primary Storage**: Browser localStorage for all analytics data persistence
- **Data Models**: Structured analytics schemas using Zod for validation
- **Mock Data**: Automated seed generation for orders, customers, products, and analytics metadata
- **No External Database**: Intentionally designed to work without server-side persistence

## Data Architecture
The application uses a simplified data warehouse structure:
- **Fact Tables**: Orders and events with dimensional references
- **Dimension Tables**: Customers, products with attributes for segmentation
- **Analytics Layer**: Hypothesis tracking, prediction logs, decision outcomes
- **Semantic Layer**: Common KPI calculations and business logic

## Key Features Integration
- **BI Dashboard**: KPI monitoring with filtering and trend visualization
- **BA Workshop**: Hypothesis creation, assumption tracking, and segment analysis
- **PA Prediction**: Time series forecasting with confidence intervals and feature importance
- **Learning Cycle**: Decision logging, outcome tracking, and ROI analysis
- **Cross-Module Context**: Filter state and hypothesis passing between modules

## External Dependencies

- **Chart.js**: Data visualization library loaded via CDN for charts and graphs
- **Mermaid**: Diagram rendering for system architecture visualization
- **Radix UI**: Headless UI primitives for accessible component foundation
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Query**: Server state management and caching (used for patterns, not actual server calls)
- **Wouter**: Lightweight routing library for single-page application navigation
- **Date-fns**: Date manipulation utilities for time series calculations
- **Zod**: Schema validation for data models and type safety
- **Class Variance Authority**: Utility for component variant management

The application is designed to run entirely in the browser with no external API calls or third-party service integrations, making it a completely self-contained analytics demonstration platform.