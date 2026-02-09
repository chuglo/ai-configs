---
description: Perform threat modeling on a feature, endpoint, or system component.
---

# Threat Model

Invokes the **threat-modeler** agent.

## Process

1. **Scope** — Identify the feature, component, or system to model
2. **Diagram** — Create a text-based Data Flow Diagram (DFD) with trust boundaries
3. **Enumerate** — Apply STRIDE to each DFD element and boundary crossing
4. **Rate** — Assess risk (Critical / High / Medium / Low) using DREAD or qualitative rating
5. **Mitigate** — Define mitigations for each threat (mitigate, eliminate, transfer, accept)
6. **Document** — Produce structured threat entries with CWE/CAPEC cross-references

## Usage

```
/threat-model <feature or component>
/threat-model auth flow
/threat-model file upload endpoint
/threat-model the entire API surface
/threat-model multi-tenant data access patterns
```

## Output

A structured threat model document containing:
- Data Flow Diagram (text-based)
- Trust boundary inventory
- Threat entries (STRIDE category, risk rating, mitigations, CWE references)
- Unmitigated threats flagged for action

**READ-ONLY**: This agent analyzes and reports. It does NOT modify code.
