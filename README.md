# SQL Chatbot

A sophisticated, real-time SQL chatbot application that enables natural language database interactions with advanced query execution, streaming responses, and intelligent SQL management capabilities.

## Overview

This application combines conversational AI with database operations, allowing users to interact with SQL databases through natural language while providing real-time streaming responses, query execution monitoring, and advanced SQL panel management. Built with modern web technologies and designed for both autonomous and guided SQL operations.

## Key Features

### Advanced SQL Operations
- **Natural Language to SQL**: Convert conversational queries into executable SQL statements
- **Live Query Execution**: Real-time SQL execution with streaming results
- **Query Interruption & Resume**: Pause and resume complex queries with state preservation
- **Query Editor**: In-panel SQL editing with syntax highlighting and validation
- **Execution History**: Complete audit trail of all SQL operations with timestamps

### Interactive SQL Panel
- **Collapsible Interface**: Toggleable SQL panel with smooth animations
- **Query Status Tracking**: Visual indicators for pending, executing, completed, and failed queries
- **Result Visualization**: Structured display of query results with expandable rows
- **Query Management**: Edit, re-execute, and organize SQL operations
- **Badge Notifications**: Real-time count of SQL operations

### User Experience
- **Responsive Design**: Mobile-first responsive interface with Tailwind CSS
- **Smooth Animations**: Framer Motion animations for seamless interactions
- **Custom UI Components**: Tailored components for optimal user experience
- **Markdown Support**: Rich text rendering with GitHub Flavored Markdown
- **Loading States**: Elegant loading indicators and thinking animations

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Full type safety and developer experience
- **Tailwind CSS 4** - Utility-first styling with latest features
- **Framer Motion** - Advanced animations and transitions

### Development Tools
- **ESLint** - Code quality and consistency
- **Turbopack** - Ultra-fast bundling for development
- **TypeScript Strict Mode** - Enhanced type checking

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/chat/stream/    # Streaming chat endpoints
│   │   └── resume/         # Query resume functionality
│   ├── layout.tsx          # Root layout component
│   └── page.tsx            # Main application page
├── components/             # React components
│   ├── chatbot.tsx         # Main chatbot interface
│   ├── message-container.tsx # Message management
│   ├── sql-panel.tsx       # SQL operations panel
│   └── ui/                 # Reusable UI components
├── lib/                    # Utility libraries
│   ├── api.ts              # API client functions
│   ├── content-parser.ts   # Response parsing logic
│   └── utils.ts            # Helper utilities
```

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm, yarn, pnpm, or bun package manager

### Environment Configuration
Create a `.env.local` file with the following variables:

```bash
YOUR_CUSTOM_AI_ENDPOINT=your_ai_service_url
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sql-chatbot

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands

```bash
npm run dev     # Start development server with Turbopack
npm run build   # Build for production
npm run start   # Start production server
npm run lint    # Run ESLint for code quality
```

## Usage

### Basic Chat Interface
1. Open the application at `http://localhost:3000`
2. Type natural language queries about your database
3. Watch real-time streaming responses
4. View generated SQL queries in the side panel

### SQL Panel Features
- **Toggle Panel**: Click the database icon to open/close the SQL panel
- **Query Monitoring**: Track all SQL operations with real-time status updates
- **Edit Queries**: Modify SQL statements directly in the panel
- **Resume Operations**: Continue interrupted or paused queries
- **Result Exploration**: Expand query results for detailed data examination

### Advanced Features
- **Autonomous Mode**: Let the AI handle all SQL operations automatically
- **Guided Mode**: Step-by-step SQL generation with user confirmation
- **Thread Persistence**: Conversations maintain context across sessions
- **Query History**: Access complete history of database interactions

## Contributing

This project uses modern development practices with TypeScript, ESLint, and comprehensive component architecture. Follow the established patterns for new features and maintain backward compatibility.

## Architecture Notes

- **Server-Sent Events**: Enables real-time streaming without WebSocket complexity
- **React Concurrent Features**: Leverages React 19's latest performance optimizations
- **Component Composition**: Modular design for maintainability and reusability
- **Type Safety**: Full TypeScript coverage for robust development experience

Built with Next.js 15 and modern web standards for optimal performance and developer experience.
