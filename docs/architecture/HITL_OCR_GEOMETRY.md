# HITL OCR geometry

Invoice capture stores a versioned `ocrPayload` JSON on `Invoice` for human-in-the-loop review:

```json
{
  "version": 1,
  "provider": "stub|textract",
  "extractedAt": "ISO-8601",
  "fields": [
    {
      "id": "vendor",
      "key": "vendorName",
      "label": "Vendor",
      "text": "Acme GmbH",
      "confidence": 0.91,
      "bbox": { "left": 0.1, "top": 0.05, "width": 0.4, "height": 0.03, "page": 1 }
    }
  ]
}
```

`bbox` uses Textract’s normalized 0–1 page coordinates (`Left` / `Top` / `Width` / `Height`).

## Providers

| Provider | Geometry |
|---|---|
| `textract` | Copied from `ValueDetection.Geometry.BoundingBox` on summary + line fields |
| `stub` | Synthetic layout boxes so local/dev HITL still supports drag-from-scan |

## Workspace UX

- Image scans: overlays drawn on the preview; drag a box onto a form field
- Text stubs: same overlays on a paper canvas behind the text
- PDFs: iframe preview + geometry map (normalized page silhouette) for drag

Existing invoices without `ocrPayload` fall back to chips derived from saved invoice columns (no boxes).
