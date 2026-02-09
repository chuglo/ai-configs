# Concurrency Patterns

## Worker Pool with errgroup
```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(runtime.NumCPU()) // Bound concurrency
for _, url := range urls {
    url := url // Go < 1.22 loop variable capture
    g.Go(func() error {
        data, err := fetch(ctx, url)
        if err != nil {
            return fmt.Errorf("fetch %s: %w", url, err)
        }
        results[i] = data
        return nil
    })
}
if err := g.Wait(); err != nil {
    return nil, err
}
```

## Graceful Shutdown
```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

if err := server.Shutdown(ctx); err != nil {
    log.Fatal().Err(err).Msg("server forced shutdown")
}
```

## Prefer Synchronous Functions
```go
// GOOD: synchronous — caller can wrap in goroutine if needed
func Process(ctx context.Context, item Item) error { ... }

// BAD: async API forces concurrency on caller
func ProcessAsync(item Item) <-chan error { ... }
```

The caller can always `go Process(...)` but cannot remove unwanted concurrency.

## Channel Direction in Signatures
```go
// GOOD: prevents accidental close or wrong-direction send
func consume(values <-chan int) { ... }
func produce(out chan<- int) { ... }

// BAD: allows caller to close or send/receive unexpectedly
func consume(values chan int) { ... }
```

## Channel Size: One or None
```go
// GOOD: unbuffered (synchronous handoff) or size 1
c := make(chan int)    // unbuffered
c := make(chan int, 1) // single-item buffer

// BAD: arbitrary large buffers are a code smell
c := make(chan int, 64) // Why 64? What if it fills?
```

Any buffer size > 1 must be justified with a comment explaining the sizing rationale.

## Never Fire-and-Forget Goroutines
```go
// BAD: no way to stop this goroutine
go func() {
    for {
        processItem()
    }
}()

// GOOD: context-controlled lifecycle
func startWorker(ctx context.Context) {
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            default:
                processItem()
            }
        }
    }()
}
```

Every goroutine must have a predictable time at which it will stop running, or a way to signal it to stop.

## Context Cancellation in Loops
```go
func processItems(ctx context.Context, items []Item) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }
        if err := process(ctx, item); err != nil {
            return fmt.Errorf("process item %s: %w", item.ID, err)
        }
    }
    return nil
}
```
