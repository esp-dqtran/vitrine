# BlockSuite and OctoBase integration sources

Astryx's experimental Project Docs integration uses these exact upstream
versions:

| Project | Version | License | Source |
| --- | --- | --- | --- |
| `@blocksuite/presets` | `0.19.5` | MPL-2.0 | <https://www.npmjs.com/package/@blocksuite/presets/v/0.19.5> |
| `@blocksuite/blocks` | `0.19.5` | MPL-2.0 | <https://www.npmjs.com/package/@blocksuite/blocks/v/0.19.5> |
| `@blocksuite/store` | `0.19.5` | MPL-2.0 | <https://www.npmjs.com/package/@blocksuite/store/v/0.19.5> |
| OctoBase | `58f3bbdf97f391a535e772d32828a484376c4159` | AGPL-3.0 | <https://github.com/toeverything/OctoBase/tree/58f3bbdf97f391a535e772d32828a484376c4159> |

Astryx consumes these projects unchanged. It does not maintain a fork, vendor
their source, use `patch-package`, or apply an Astryx-owned Cargo patch.

This record covers an experimental integration proof only. It is not
production licensing approval. Astryx requires legal review of the exact
versions, source-availability obligations, network deployment boundary, and
AGPL-3.0 requirements before production use.
