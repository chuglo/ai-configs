---
description: "Go TDD workflow with table-driven tests. Usage: /go-test <function-or-package>"
---

# Go Test

Implement using Go TDD methodology for: $1

**Target package or function**: $1

## TDD Cycle

1. **Define types** -- Interfaces and structs
2. **Write table-driven tests** -- Comprehensive coverage
3. **Implement minimal code** -- Pass the tests
4. **Benchmark** -- Verify performance

## Table-Driven Test Pattern

```go
func TestFunction(t *testing.T) {
    tests := []struct {
        name    string
        input   Input
        want    Output
        wantErr bool
    }{
        {"valid input", Input{...}, Output{...}, false},
        {"invalid input", Input{...}, Output{}, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Function(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("got %v, want %v", got, tt.want)
            }
        })
    }
}
```

## Commands

```bash
go test -v ./...                    # Verbose
go test -race ./...                 # Race detector
go test -cover ./...                # Coverage
go test -bench=. ./...              # Benchmarks
go test -run TestSpecific ./pkg/    # Specific test
```
