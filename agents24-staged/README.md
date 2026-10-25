# Permanent document retrieval phase

`workflows/document-search.yaml` is the authored subsequent-phase workflow. It is intentionally outside the active resource package while its inclusion triggers an Agents24 draft-apply failure. Do not enable `PRYSM_DOCUMENT_LIBRARY_ENABLED` until this resource applies and the permanent-file ingestion/retrieval acceptance passes.

After the platform fix, copy the workflow to `agents24/workflows/document-search.yaml` and add this stable declaration between `document-evidence` and `documents` in `agents24/agents24.yaml`:

```yaml
- key: document-search
  path: workflows/document-search.yaml
```

Its relative Store reference resolves from that destination. Validate and plan through the official CLI before applying to the authorized environment. Obtain the resulting executable Agent and Store IDs through the public installation contract. No resource UUID, private platform shim, or manual raw-vector fallback belongs in source.

See [implementation and rollout](../docs/design-docs/agents24-search-reports.md) and [platform reproduction](../docs/agents24-feedback.md).
