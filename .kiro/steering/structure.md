# Project Structure

## Root Directory
```
├── src/                    # Main application source code
├── functions/              # Firebase Cloud Functions
├── scripts/                # Utility and maintenance scripts
├── docs/                   # Project documentation
├── .kiro/                  # Kiro AI assistant configuration
└── [config files]         # Various configuration files
```

## Source Code Organization (`src/`)

### Application Structure
- `src/app/` - Next.js App Router pages and layouts
  - `(dashboard)/` - Protected dashboard routes
  - `auth/` - Authentication pages
  - `debug/` - Development/debugging utilities
- `src/components/` - React components
  - `ui/` - Reusable UI components (Radix-based)
  - Modal components for various entities
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility libraries and configurations
- `src/services/` - Business logic and API services
- `src/types/` - TypeScript type definitions
- `src/ai/` - Genkit AI flows and configurations

### Service Layer Pattern
Each business domain has its own service file:
- `auth-service.ts` - Authentication operations
- `branch-service.ts` - Branch management
- `cash-register-service.ts` - POS operations
- `customer-service.ts` - Customer management
- `inventory-service.ts` - Stock management
- `product-service.ts` - Product catalog
- `sales-service.ts` - Sales transactions
- `settings-service.ts` - Application settings
- `user-service.ts` - User management

### Type Definitions
Strongly typed interfaces for all entities:
- `branch.d.ts` - Branch/location types
- `cash-register.d.ts` - POS session types
- `customer.d.ts` - Customer data types
- `product.d.ts` - Product catalog types
- `sale.d.ts` - Transaction types
- `user.d.ts` - User and role types

## Firebase Functions (`functions/`)
- `index.js` - Main functions entry point
- `package.json` - Functions dependencies (Node.js 20)
- Server-side user management and account operations

## Scripts Directory (`scripts/`)
Utility scripts for development and maintenance:
- User management scripts
- Session management utilities
- Account provisioning tools
- Testing and seeding scripts
- `tests/` - Smoke tests for core functionality

## Configuration Files
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - TailwindCSS setup
- `tsconfig.json` - TypeScript configuration
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules
- `.env.example` - Environment variables template

## Naming Conventions
- **Files**: kebab-case for components, camelCase for utilities
- **Components**: PascalCase React components
- **Services**: Descriptive names ending in `-service.ts`
- **Types**: Domain-specific `.d.ts` files
- **Hooks**: Prefix with `use-` (e.g., `use-auth.tsx`)

## Import Patterns
- Use `@/` alias for src directory imports
- Group imports: external libraries, internal modules, relative imports
- Prefer named exports over default exports for utilities