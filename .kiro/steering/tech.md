# Technology Stack

## Frontend Framework
- **Next.js 15** with App Router and Turbopack for development
- **React 18** with TypeScript for type safety
- **TailwindCSS** for styling with custom design system
- **Radix UI** components for accessible, unstyled primitives

## Backend & Database
- **Firebase Firestore** for real-time NoSQL database
- **Firebase Authentication** for user management
- **Firebase Functions** (Node.js 20) for server-side logic
- **Firebase Admin SDK** for privileged operations

## AI Integration
- **Google Genkit** for AI flows and integrations
- **Google AI** integration for enhanced features

## Key Libraries
- **React Hook Form** + **Zod** for form validation
- **Lucide React** for icons
- **Recharts** for data visualization
- **date-fns** for date manipulation
- **class-variance-authority** + **clsx** for conditional styling

## Development Tools
- **TypeScript** for static typing
- **ESLint** for code linting
- **PostCSS** for CSS processing
- **patch-package** for dependency patches

## Common Commands

### Development
```bash
npm run dev          # Start development server on port 9002 with Turbopack
npm run genkit:dev   # Start Genkit development server
npm run genkit:watch # Start Genkit with file watching
```

### Build & Deploy
```bash
npm run build        # Build production application
npm run start        # Start production server
npm run typecheck    # Run TypeScript type checking
npm run lint         # Run ESLint
```

### Testing
```bash
npm run smoke        # Run smoke tests for core functionality
```

## Environment Setup
- Copy `.env.example` to `.env.local`
- Configure Firebase project credentials
- Set up Genkit API key if using AI features

## Architecture Notes
- Uses Firebase security rules for data access control
- Multi-tenant architecture with account-based isolation
- Real-time data synchronization across all clients
- Role-based permissions enforced at database level