---
name: frontend-patterns
description: Next.js 16 + React 19 patterns for {{PROJECT_NAME}}. App Router, TanStack Query, shadcn/ui, form handling, SSR vs SPA. Use when writing React components, creating routes, building forms, or working with TanStack Query.
compatibility: Next.js 16, React 19, TanStack Query, shadcn/ui, Tailwind CSS 4
---

# Frontend Patterns for {{PROJECT_NAME}}

## When to Activate

- Writing React components
- Creating new pages or routes
- Working with TanStack Query/Table
- Building forms with react-hook-form + zod
- Implementing drag-and-drop (dnd-kit)

## Rendering Strategy

| Audience | Route Group | Rendering | Auth |
|----------|-------------|-----------|------|
| Public | `/(public)/*` | SSR | No |
| Authenticated (read) | `/(viewer)/*` | SSR + Client | Optional |
| Team | `/(dashboard)/*` | Client (SPA) | Yes |

## Route File Conventions

Every route group MUST include these files:

```
app/(dashboard)/
  layout.tsx       -- Shared layout with nav, auth guard
  loading.tsx      -- Suspense fallback (skeleton UI)
  error.tsx        -- Error boundary ('use client', receives error + reset)
  dashboard/
    items/
      page.tsx
      loading.tsx  -- Route-specific loading (optional, inherits parent)
    team/
      page.tsx
```

### error.tsx Pattern
```typescript
'use client'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
                {error.message || 'An unexpected error occurred.'}
            </p>
            <Button onClick={reset} variant="outline">Try again</Button>
        </div>
    )
}
```

### loading.tsx Pattern
```typescript
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
```

## TanStack Query Patterns

### Query Options Factory (PREFERRED)

Use `queryOptions()` to create reusable, type-safe query configurations. Centralize in `web/src/lib/queries/`:

```typescript
// web/src/lib/queries/team.ts
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TeamMember, CurrentUser } from '@/lib/types'

export const teamQueryOptions = queryOptions({
    queryKey: ['team'],
    queryFn: () => api.team.list(),
})

export const currentUserQueryOptions = queryOptions({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
})

// Parameterized query options
export const itemQueryOptions = (id: string) =>
    queryOptions({
        queryKey: ['items', id],
        queryFn: () => api.items.get(id),
    })
```

Then use in hooks:
```typescript
// web/src/hooks/use-team.ts
import { useQuery } from '@tanstack/react-query'
import { teamQueryOptions } from '@/lib/queries/team'

export function useTeamMembers() {
    return useQuery(teamQueryOptions)
}
```

Benefits:
- Type-safe query keys (no typo-based cache misses)
- Reusable for prefetching: `queryClient.prefetchQuery(teamQueryOptions)`
- Reusable for cache reads: `queryClient.getQueryData(teamQueryOptions.queryKey)`

### Suspense Queries (PREFERRED for data-dependent components)

Use `useSuspenseQuery` when a component cannot render without data:

```typescript
import { useSuspenseQuery } from '@tanstack/react-query'
import { teamQueryOptions } from '@/lib/queries/team'

// Data is guaranteed non-null — no loading/error checks needed
function TeamTable() {
    const { data: members } = useSuspenseQuery(teamQueryOptions)
    return <Table>{members.map(m => <Row key={m.id} member={m} />)}</Table>
}

// Parent handles loading/error via Suspense + ErrorBoundary
<ErrorBoundary fallback={<ErrorState />}>
    <Suspense fallback={<TeamTableSkeleton />}>
        <TeamTable />
    </Suspense>
</ErrorBoundary>
```

### Basic Query (when Suspense is not appropriate)
```typescript
import { useQuery } from '@tanstack/react-query'
import { teamQueryOptions } from '@/lib/queries/team'

export function useTeamMembers() {
    return useQuery(teamQueryOptions)
}
```

### Mutation with Optimistic Update

For user-facing mutations (role changes, status updates), use optimistic updates to eliminate loading flashes:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { teamQueryOptions } from '@/lib/queries/team'
import type { Role } from '@/lib/types'

export function useUpdateTeamMemberRole() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, role }: { id: string; role: Role }) =>
            api.team.updateRole(id, role),
        onMutate: async ({ id, role }) => {
            // Cancel in-flight queries to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: teamQueryOptions.queryKey })
            // Snapshot previous value for rollback
            const previous = queryClient.getQueryData(teamQueryOptions.queryKey)
            // Optimistically update cache
            queryClient.setQueryData(teamQueryOptions.queryKey, (old) =>
                old?.map(m => m.id === id ? { ...m, role } : m)
            )
            return { previous }
        },
        onError: (_err, _vars, context) => {
            // Rollback on error
            if (context?.previous) {
                queryClient.setQueryData(teamQueryOptions.queryKey, context.previous)
            }
        },
        onSettled: () => {
            // Always refetch to ensure server state is canonical
            queryClient.invalidateQueries({ queryKey: teamQueryOptions.queryKey })
        },
    })
}
```

For simple mutations where optimistic updates aren't needed:
```typescript
export function useRemoveTeamMember() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => api.team.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: teamQueryOptions.queryKey })
        },
    })
}
```

### QueryClient Configuration

```typescript
new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,  // 1 minute
            retry: 1,
        },
        mutations: {
            throwOnError: true,  // Unhandled mutation errors bubble to error boundaries
        },
    },
})
```

## Error Handling

### Error Boundary Component

Wrap data-fetching regions with error boundaries. Use `react-error-boundary` or a custom component:

```typescript
'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.props.onError?.(error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
                    <p className="text-sm text-destructive">
                        Something went wrong. Please try refreshing the page.
                    </p>
                </div>
            )
        }
        return this.props.children
    }
}
```

### Error Handling Hierarchy

```
RootLayout
  +- Global ErrorBoundary (catches unhandled errors)
      +- Providers (QueryClient, Toaster)
          +- Route Group Layout
              +- error.tsx (Next.js route-level error boundary)
                  +- Feature ErrorBoundary (optional, for isolated sections)
                      +- Suspense (loading states)
                          +- Component (useSuspenseQuery)
```

## React 19 Patterns

### useTransition for Non-Urgent Updates

Use `useTransition` for filter changes, tab switches, and search to keep the UI responsive:

```typescript
import { useTransition } from 'react'

function ItemFilters({ onFilterChange }: { onFilterChange: (status: string) => void }) {
    const [isPending, startTransition] = useTransition()

    function handleStatusChange(status: string) {
        startTransition(() => {
            onFilterChange(status)  // Non-urgent, won't block user input
        })
    }

    return (
        <Select onValueChange={handleStatusChange}>
            {isPending && <Loader2 className="animate-spin" />}
            {/* ... */}
        </Select>
    )
}
```

### useOptimistic for Instant UI Feedback

```typescript
import { useOptimistic } from 'react'

function ItemStatus({ item, onStatusChange }) {
    const [optimisticStatus, setOptimisticStatus] = useOptimistic(item.status)

    async function handleChange(newStatus: ItemStatus) {
        setOptimisticStatus(newStatus)  // Instant UI update
        await onStatusChange(item.id, newStatus)  // Server request
    }

    return <Badge>{optimisticStatus}</Badge>
}
```

## Form Handling (react-hook-form + zod)

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createItemSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    email: z.string().email('Valid email required'),
})

type CreateItemForm = z.infer<typeof createItemSchema>

export function ItemCreationForm() {
    const form = useForm<CreateItemForm>({
        resolver: zodResolver(createItemSchema),
    })

    const onSubmit = async (data: CreateItemForm) => {
        await api.items.create(data)
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Form fields */}
        </form>
    )
}
```

## Component Patterns

### Composition
```typescript
interface CardProps {
    children: React.ReactNode
    variant?: 'default' | 'outlined'
}

export function Card({ children, variant = 'default' }: CardProps) {
    return <div className={cn('card', variant)}>{children}</div>
}
```

### Custom Hooks
```typescript
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])

    return debouncedValue
}
```

### data-testid Convention

Add `data-testid` to elements that E2E tests need to target reliably:

```typescript
// List items / table rows (semantic locators are ambiguous)
<TableRow data-testid={`team-member-${member.id}`}>

// Complex interactive regions
<div data-testid="item-list">

// NOT needed for: buttons with text, labeled inputs, headings (use role locators)
```

## API Client Pattern

```typescript
// web/src/lib/api.ts
// Always same-origin — Next.js rewrites proxy /api/* to the Go backend
const API_BASE = '/api/v1'

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message)
        this.name = 'ApiError'
    }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    let res: Response
    try {
        res = await fetch(`${API_BASE}${path}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        })
    } catch {
        throw new ApiError(0, 'Network error: unable to reach server')
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }))
        throw new ApiError(res.status, error.error || res.statusText)
    }

    // Handle empty responses (204 No Content, etc.)
    const text = await res.text()
    if (!text) return undefined as T

    return JSON.parse(text) as T
}
```

## Accessibility (a11y)

### Required Practices

- **Labels**: Every form input MUST have an associated `<Label htmlFor="...">` or `aria-label`
- **Icon buttons**: MUST have `sr-only` text or `aria-label`
  ```typescript
  <Button variant="ghost" size="sm">
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">Actions for {member.name}</span>
  </Button>
  ```
- **Images**: MUST have `alt` text; decorative images use `alt=""`
- **Color**: Never the sole indicator — pair with icons, text, or patterns
- **Focus**: Modals/dialogs must trap focus (Radix handles this automatically)
- **Keyboard**: All interactive elements reachable via Tab; Escape closes modals

### Testing a11y

- Unit tests: Query by role/label (React Testing Library default)
- E2E tests: `@axe-core/playwright` for automated WCAG 2.1 AA scanning
- Manual: Tab through every interactive flow; use screen reader

## Type Definitions

```typescript
// web/src/lib/types.ts -- Mirror Go structs exactly
export type ItemStatus =
    | 'active' | 'pending' | 'archived' | 'completed'

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type Role = 'owner' | 'admin' | 'editor' | 'viewer'
```

Use union types (`Role`, `Priority`) in function signatures — never `string` where the set of values is known.

## shadcn/ui Usage

- Components live in `web/src/components/ui/`
- DO NOT edit these files directly
- Add new components via: `npx shadcn@latest add [component]`
- Customize via Tailwind classes, not component source

## Performance

- SSR for public pages (SEO, speed)
- SPA for authenticated dashboard (rich interactivity)
- TanStack Query for server state caching
- Dynamic imports for code splitting
- Next.js Image for optimized images
- `useMemo`/`useCallback` for expensive computations
- `useTransition` for non-urgent state updates (filters, search)
