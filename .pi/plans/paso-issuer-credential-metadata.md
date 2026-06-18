# Plan: PaSO Issuer-side Credential Metadata (signed `credential_metadata_uri`)

> Supersedes earlier drafts in this file. This version reflects the **actual**
> code paths in `apps/backend/`.

## Goal

Implement the **Issuer / Attestation Provider** half of the
[PaSO Proof: Metadata Module][1] in EUDIPLO: serve signed credential metadata
that carries `transaction_data_types` from a new `credential_metadata_uri`,
advertise the URI from the OID4VCI well-known metadata, and bind the JWT to
the credential's existing attestation `x5c` chain. **Do not** modify the
verifier; **do not** add PaSO-specific validation of incoming presentations.

[1]: /Users/senexi/dev/eudiw/payments-and-sca-for-openid/docs/specs/proof/paso-proof-metadata.md

## Findings

PaSO spec, issuer-only obligations:

- New OID4VCI parameter `credential_metadata_uri` on entries in
  `credential_configurations_supported`. (§2)
- Content negotiation on the metadata URL: `Accept: application/json` →
  unsigned JSON; `Accept: application/jwt` → signed JWT. `Accept-Language`
  drives locale filtering; AP MAY refuse without it but is not required to.
  (§2)
- Signed JWT shape: header `{ typ: "credential-metadata+jwt", alg, x5c }`,
  payload `{ iss, sub, format, iat, exp, credential_metadata_uri,
  credential_metadata }`. The `credential_metadata` is OID4VCI §12.2.4
  extended with `transaction_data_types`. (§4)
- `transaction_data_types` (§3): map keyed by
  `urn:paso:sca:<domain>:<suffix>:<version>` (per PaSO Core §5.2). Each value
  has `claims` (REQUIRED — path/mandatory/display/value_type) plus optional
  `ui_labels` (`affirmative_action_label`, `denial_action_label`,
  `transaction_title`, `security_hint`).
- Cryptographic binding (§6.6): `sub` matches credential type id (`vct` for
  SD-JWT VC, `doctype` for mdoc); root CA in the metadata `x5c` matches the
  credential's root CA; leaf Subject of the metadata `x5c` matches the
  credential's leaf Subject. Practically: sign with the same
  `KeyUsageType.Attestation` cert chain (and same `keyChainId`) that signs
  the credential.

EUDIPLO codebase — accurate inventory after re-reading:

- **OID4VCI well-known URL convention is reversed from what I previously
  wrote**: the route is
  `GET /.well-known/openid-credential-issuer/issuers/:tenantId`, not the
  nested form. See `apps/backend/src/issuer/issuance/oid4vci/well-known/well-known.controller.ts:33`.
  **No placeholder for `credential-metadata` exists yet.**
- `WellKnownService.getIssuerMetadata(tenantId, contentType: MediaType)`
  already supports JSON↔JWT content negotiation via the shared
  `MediaType` enum and `@ContentType()` parameter decorator. The signed
  variant uses `KeyUsageType.Access` and `typ: "openidvci-issuer-metadata+jwt"`.
  We do **not** modify this; PaSO needs a *separate* signing path with
  `KeyUsageType.Attestation` and `typ: "credential-metadata+jwt"`.
- Metadata building lives in
  `apps/backend/src/issuer/configuration/credentials/credentials.service.ts:getCredentialConfigurationSupported`,
  which routes to `buildMdocConfiguration` / `buildSdJwtConfiguration`. Both
  produce a `credential_metadata` object (display + claims metadata via
  `buildClaimsMetadata`) that they merge into the per-credential entry. So
  `credential_metadata` is already assembled inline per credential — we add
  the new URI field there and lift `transaction_data_types` into the same
  object when the credential has PaSO config.
- `CredentialConfig.config` is **typed** (`IssuerMetadataCredentialConfig`),
  not a free `Record<string, any>` blob. Fields include `format`, `display`,
  `scope`, **`docType`** (for `mso_mdoc`), `keyAttestationsRequired`. So my
  earlier worry about where `doctype` lives is answered: it's
  `credential.config.docType`.
- `CredentialConfig.keyChainId` is the existing way credentials pin a
  particular `KeyUsageType.Attestation` cert; `SdjwtvcIssuerService.issue`
  uses `this.certService.find({ tenantId, type: KeyUsageType.Attestation,
  keyId: credentialConfiguration.keyChainId })`. We reuse the exact same
  call, so §6.6 binding is automatic.
- `KeyChainService.signJWT(payload, header, tenantId, keyId)` is the JWT
  signing entrypoint (delegates to `KeyChainSigningService.signJWT`).
- `CryptoImplementationService.getAlg()` returns the right `alg` (`ES256`
  in practice) for the active key.
- `CertService.getCertChain(cert)` returns the `x5c` chain (base64 DER, not
  base64url) — the same array used by `sdjwtvcIssuerService`.
- The schema-metadata code path
  (`apps/backend/src/issuer/configuration/credentials/schema-meta/schema-metadata-signing.service.ts`,
  plus `apps/backend/src/registrar/schema-metadata.controller.ts`) is the
  best in-tree analogue for "build a typed config, sign as JWT, expose via
  a dedicated endpoint." Mirror its shape, not the verbose registrar
  HTTP-client service.
- `ContentType` decorator + `MediaType` enum
  (`apps/backend/src/shared/utils/mediaType/`) — reuse, don't re-parse
  `Accept` ourselves.
- No `Accept-Language` parsing anywhere yet (`grep` returned no matches).
  We need a small helper.
- Existing credential fixtures under
  `apps/backend/test/fixtures/haip/issuance/credentials/` have a `fields[]`
  array (not `claims`) and the credential-internal config uses `vct` /
  `docType`. The PaSO config will live next to those at the top level
  (sibling of `fields`).
- Migrations directory pattern is timestamp-prefixed under
  `apps/backend/src/database/migrations/`; index re-exports each migration.
- No cache layer is in place on the well-known endpoint (the earlier draft
  was wrong about that — I had hallucinated a CACHE_MANAGER injection). We
  do not need to introduce one for this change; HTTP `Cache-Control:
  public, max-age=...` is sufficient for now.

## Approach

Add a tenant-scoped, locale-aware **credential metadata** endpoint that
serves the OID4VCI `credential_metadata` document — JSON by default, signed
`credential-metadata+jwt` on `Accept: application/jwt`. Make the URL
discoverable by emitting `credential_metadata_uri` on each PaSO-enabled
entry of `credential_configurations_supported`. Model PaSO configuration as
a **new typed `paso` column** on `CredentialConfig` so it lives next to the
existing `schemaMeta`, `embeddedDisclosurePolicy`, etc. Reuse the existing
`KeyUsageType.Attestation` cert (resolved with `credential.keyChainId`),
which automatically satisfies §6.6 binding because it's the very same chain
used to sign the credential.

Rejected:

- *Inline `transaction_data_types` into the unsigned well-known response*.
  Spec is fine with both inline and behind a `credential_metadata_uri`, but
  the spec's strongest property — tamper-evidence — only kicks in once you
  serve the signed JWT. Use the dedicated URI.
- *Squeeze PaSO into the existing freeform `credential.config` blob*. That
  blob is now typed (`IssuerMetadataCredentialConfig`), so this isn't even
  free. Adding `paso` as its own typed column keeps OpenAPI/SDK shapes
  clean.
- *Reuse the existing `WellKnownService` signing path*. It uses
  `KeyUsageType.Access` and `typ: "openidvci-issuer-metadata+jwt"`. PaSO
  requires `KeyUsageType.Attestation` and
  `typ: "credential-metadata+jwt"`. Different concern — different code
  path.

## Steps

1. **New PaSO DTO.**
   - Add `apps/backend/src/issuer/configuration/credentials/dto/paso-config.dto.ts`:
     - `PasoFieldDisplay { locale, name, display_type? }`
     - `PasoClaimMetadata { path: Array<string|number|null>, mandatory?,
       display?: PasoFieldDisplay[], value_type? }` — with a custom
       class-validator constraint enforcing "`value_type` only when
       `display` is present" per spec §3.1.
     - `PasoUiLabelEntry { locale?, value, value_type? }`
     - `PasoUiLabels { affirmative_action_label?: PasoUiLabelEntry[],
       denial_action_label?: PasoUiLabelEntry[],
       transaction_title?: PasoUiLabelEntry[],
       security_hint?: PasoUiLabelEntry[] } & Record<string, PasoUiLabelEntry[]>`
       — also allow arbitrary rulebook-defined labels; wallet MUST ignore
       unknowns.
     - `PasoTransactionDataTypeConfig { claims: PasoClaimMetadata[],
       ui_labels?: PasoUiLabels }` with `additionalProperties: true` in
       Swagger so future rulebook fields survive round-trips.
     - `PasoConfig { transactionDataTypes: Record<string,
       PasoTransactionDataTypeConfig>, signedMetadataLifetimeSeconds?:
       number }` with `@Matches(/^urn:paso:sca:[^:]+:[^:]+:[^:]+$/)` on
       each key (PaSO Core §5.2 referenced by paso-proof-metadata.md §3).
   - Edit
     `apps/backend/src/issuer/configuration/credentials/entities/credential.entity.ts`:
     add `@Column("json", { nullable: true }) @ValidateNested() @Type(() =>
     PasoConfig) @ApiPropertyOptional({ type: () => PasoConfig }) paso?:
     PasoConfig | null;` alongside `schemaMeta`. `CredentialConfigCreate`
     and `CredentialConfigUpdate` (`OmitType` + `PartialType`) inherit it
     automatically.

2. **DB migration.**
   - Add `apps/backend/src/database/migrations/<TS>-AddPasoToCredentialConfig.ts`
     adding nullable `paso JSON` column to `credential_config`. Match the
     dialect-aware style of `1761000000000-AddSchemaMetaToCredentialConfig.ts`.
   - Export from `apps/backend/src/database/migrations/index.ts`.

3. **Credential metadata DTO.**
   - Add `apps/backend/src/issuer/issuance/oid4vci/well-known/dto/credential-metadata.dto.ts`:
     - `CredentialMetadata` (the OID4VCI §12.2.4 doc): `display?: Display[]`,
       `claims?: ClaimMetadata[]`, `transaction_data_types?:
       Record<string, PasoTransactionDataTypeConfig>`, with
       `additionalProperties: true`.
     - `SignedCredentialMetadataJwtPayload { iss, sub, format, iat, exp,
       credential_metadata_uri, credential_metadata: CredentialMetadata }`.
   - Re-export from a barrel where the existing well-known DTOs sit.

4. **Build + sign service.**
   - Add
     `apps/backend/src/issuer/issuance/oid4vci/well-known/credential-metadata.service.ts`
     with:
     - Constructor inject `CredentialsService` (to load
       `CredentialConfig`), `CertService`, `KeyChainService`,
       `CryptoImplementationService`, `ConfigService`.
     - `parseAcceptLanguage(header: string | undefined): string[]` — small
       helper, RFC 5646 with q-values; returns priority list (empty if no
       header, caller falls back).
     - `buildCredentialMetadata(credential: CredentialConfig, locales:
       string[]): CredentialMetadata`:
       - `display` filtered (preserves order of `locales`) from
         `credential.config.display`;
       - `claims` derived from `credential.fields` via
         `buildClaimsMetadata`, then `claim.display` filtered to `locales`;
       - if `credential.paso?.transactionDataTypes` is present, project it
         into `transaction_data_types` with the same locale filter applied
         to each `claims[*].display[*]` and each `ui_labels[*][*]`.
     - `getMetadataDocument(tenantId, credentialId, mediaType,
       acceptLanguage)`:
       - load credential or throw 404;
       - parse `acceptLanguage` → `locales` (fallback to the first locale
         on `credential.config.display`, then to `"en"`);
       - build `CredentialMetadata`;
       - if `mediaType === application/json` return `{ body, contentType:
         application/json }`;
       - if `mediaType === application/jwt`:
         - resolve `cert =
           certService.find({ tenantId, type: KeyUsageType.Attestation,
           keyId: credential.keyChainId })`;
         - build the URI:
           `${PUBLIC_URL}/.well-known/openid-credential-issuer/issuers/${tenantId}/credential-metadata/${credentialId}`;
         - build payload `{ iss:
           "${PUBLIC_URL}/issuers/${tenantId}", sub:
           credential.config.format === "mso_mdoc" ?
           credential.config.docType : (typeof credential.vct === "string"
           ? credential.vct : credential.id), format:
           credential.config.format, iat, exp: iat +
           (credential.paso?.signedMetadataLifetimeSeconds ?? 86400),
           credential_metadata_uri, credential_metadata: ... }`;
         - build header `{ alg: cryptoImpl.getAlg(), x5c:
           certService.getCertChain(cert), typ: "credential-metadata+jwt" }`;
         - `jwt = keyChainService.signJWT(payload, header, tenantId,
           cert.keyId)`;
         - return `{ body: jwt, contentType: application/jwt }`.
   - Register the service in the module that owns `WellKnownService` (the
     `Oid4vciModule` if I read the imports right; confirm during
     implementation).

5. **Wire the controller.**
   - Edit `well-known.controller.ts`:
     - Add a new `@Get(".well-known/openid-credential-issuer/issuers/:tenantId/credential-metadata/:credentialId")`
       route mirroring the existing pattern.
     - Inject the new service; accept `@ContentType() contentType:
       MediaType` and `@Headers("Accept-Language") acceptLanguage?:
       string`; manual `Content-Type` header set on the response (same
       pattern as `issuerMetadata`).
     - Add `@Header("Cache-Control", "public, max-age=300")` — matches the
       schema-metadata endpoint's caching.
     - Use `@ApiProduces(MediaType.APPLICATION_JSON, MediaType.APPLICATION_JWT)`
       so OpenAPI describes both modes.

6. **Emit `credential_metadata_uri` in the well-known response.**
   - Edit
     `apps/backend/src/issuer/configuration/credentials/credentials.service.ts`
     in `buildSdJwtConfiguration` and `buildMdocConfiguration`: when
     `entity.paso?.transactionDataTypes` is non-empty, include
     `credential_metadata_uri: "${PUBLIC_URL}/.well-known/openid-credential-issuer/issuers/${tenantId}/credential-metadata/${entity.id}"`
     in the returned config object (sibling of `credential_metadata`).
   - Non-PaSO credentials get no `credential_metadata_uri` — least
     intrusive.
   - The well-known response is **not currently cached**, so no cache
     invalidation work is needed.

7. **Test fixture.**
   - Add `apps/backend/test/fixtures/haip/issuance/credentials/sca-payment.json`:
     - SD-JWT VC credential, `vct: "https://bank.example/sca/card"`,
       `keyChainId` set to the attestation key chain used elsewhere in the
       haip fixture set;
     - `paso.transactionDataTypes["urn:paso:sca:global:payment:1"]` with
       `claims` and `ui_labels` for `en` + `de` (mirroring spec §A.2);
     - `paso.signedMetadataLifetimeSeconds: 86400`.

8. **Tests.**
   - Unit `apps/backend/src/issuer/issuance/oid4vci/well-known/credential-metadata.service.spec.ts`:
     - `parseAcceptLanguage("de, en;q=0.8")` → `["de", "en"]`; empty header
       → `[]`.
     - `buildCredentialMetadata` filters `display`, `claims[*].display`,
       `transaction_data_types[*].claims[*].display`,
       `transaction_data_types[*].ui_labels[*][*]` to the requested
       locales while preserving order.
   - e2e `apps/backend/test/issuance/paso-credential-metadata.e2e-spec.ts`:
     - well-known endpoint includes `credential_metadata_uri` for the new
       fixture but **not** for `pid`/`pid-mdoc`;
     - JSON: `GET .../credential-metadata/sca-payment` with `Accept:
       application/json, Accept-Language: de` returns JSON whose
       `transaction_data_types["urn:paso:sca:global:payment:1"].claims[*].display[*].locale`
       is only `de`;
     - JWT: same URL with `Accept: application/jwt` returns a string body;
       decode and verify:
       - JOSE header `typ=credential-metadata+jwt`, `x5c` present;
       - payload `iss === "${PUBLIC_URL}/issuers/tenant-haip"`,
         `sub === "https://bank.example/sca/card"`,
         `format === "dc+sd-jwt"`, `iat <= now < exp`,
         `credential_metadata_uri` echoes the request URL;
       - signature verifies against the leaf `x5c` cert (jose `jwtVerify`
         with the leaf cert's public key);
       - leaf Subject of the metadata `x5c` matches leaf Subject of the
         credential's `x5c` (load via `CertService` for the same
         `keyChainId`) — proves §6.6 binding.
     - negative: POST a credential with PaSO key
       `urn:not-paso:foo:bar:1` → HTTP 400;
     - negative: POST PaSO claim with `value_type` but no `display` → HTTP 400.

9. **Docs.**
   - Add `docs/getting-started/issuance/paso-credential-metadata.md`
     covering:
     - what PaSO is and the role EUDIPLO plays here (Issuer / AP only);
     - the new credential-config `paso` block, with a worked example
       adapted from spec §A.2;
     - the endpoint URL and content-negotiation behaviour;
     - that the JWT is bound to the credential's attestation `x5c` and is
     invalidated when the attestation key chain rotates;
     - what is **not** done (verifier side, presentation-time PaSO checks,
       wallet-side behaviour).
   - Link from `docs/getting-started/issuance/index.md`.

10. **Codegen.**
    - After steps 1–6 are merged: run `pnpm run gen:api` (backend on :3000)
      then `pnpm run gen:sdk`. New JSON Schemas land in `schemas/` and
      types in `packages/eudiplo-sdk-core/src/api/{schemas,types}.gen.ts`.
      Never hand-edit `.gen.ts`.

## Files touched

- **Add** `apps/backend/src/issuer/configuration/credentials/dto/paso-config.dto.ts`
- **Add** `apps/backend/src/issuer/issuance/oid4vci/well-known/dto/credential-metadata.dto.ts`
- **Add** `apps/backend/src/issuer/issuance/oid4vci/well-known/credential-metadata.service.ts`
- **Add** `apps/backend/src/issuer/issuance/oid4vci/well-known/credential-metadata.service.spec.ts`
- **Add** `apps/backend/src/database/migrations/<TS>-AddPasoToCredentialConfig.ts`
- **Add** `apps/backend/test/fixtures/haip/issuance/credentials/sca-payment.json`
- **Add** `apps/backend/test/issuance/paso-credential-metadata.e2e-spec.ts`
- **Add** `docs/getting-started/issuance/paso-credential-metadata.md`
- **Edit** `apps/backend/src/issuer/configuration/credentials/entities/credential.entity.ts` — add typed `paso?` column.
- **Edit** `apps/backend/src/issuer/configuration/credentials/credentials.service.ts` — `buildSdJwtConfiguration` and `buildMdocConfiguration` emit `credential_metadata_uri` when `paso` is set.
- **Edit** `apps/backend/src/issuer/issuance/oid4vci/well-known/well-known.controller.ts` — add `credential-metadata/:credentialId` route.
- **Edit** the OID4VCI well-known/issuance module(s) — register `CredentialMetadataService`.
- **Edit** `apps/backend/src/database/migrations/index.ts` — export new migration.
- **Edit** `docs/getting-started/issuance/index.md` — link the new page.
- **No change** to any file under `apps/backend/src/verifier/` (per user instruction).
- **Regenerate** `schemas/*.schema.json` and the `@eudiplo/sdk-core`
  generated artifacts via `pnpm run gen:api` + `pnpm run gen:sdk`.

## Risks / open questions

- **Cert binding rotates with credential.** Because we use the same
  `keyChainId` as the credential, attestation cert rotation invalidates
  previously-issued metadata JWTs the wallet may have cached. Wallets
  re-fetch before `exp`, so the practical impact is bounded by
  `signedMetadataLifetimeSeconds` (default 24 h). Document this; consider
  a future "rotate metadata JWTs on cert rotation" hook.
- **`sub` for mdoc.** Confirmed `credential.config.docType` exists for
  mdoc. Order in the spec is "`vct` for SD-JWT VC, `doctype` for mdoc";
  fallback to `credential.id` only if neither is set (unlikely).
- **Wallet linkability (§7).** Issuer-side mitigation is `Cache-Control:
  public, max-age=…`. Same as our schema-metadata endpoint.
- **OID4VCI §12.2.4 shape drift.** Keep `CredentialMetadata` DTO
  permissive (`additionalProperties: true`); only validate `display`,
  `claims`, `transaction_data_types`.
- **`Accept-Language` "refuse without it" policy.** Spec lets the AP
  refuse. We choose to serve with a fallback (default to first display
  locale, then `en`) — friendlier and matches how we already handle other
  endpoints. Documented in `paso-credential-metadata.md`.
- **PaSO Core URN grammar.** `^urn:paso:sca:[^:]+:[^:]+:[^:]+$` is a
  reasonable reading of §5.2 as referenced from paso-proof-metadata.md.
  Adjust if Core publishes a stricter grammar.
- **No caching layer in well-known.** Different from what an earlier draft
  of this plan said. We rely on HTTP cache headers. If we later add an
  in-process cache, we'll need invalidation hooks on credential-config
  updates — fine to defer.
- **No verifier-side checks.** Per the user's instruction, no file under
  `apps/backend/src/verifier/` is modified. `Oid4vpService` continues to
  forward `transaction_data` opaquely and validate KB-JWT
  `transaction_data_hashes` per OID4VP. PaSO Wallet/Verifier semantics
  are not enforced. Call this out in the docs page so integrators don't
  mistakenly assume the verifier is PaSO-aware.

## Acceptance criteria

- A `CredentialConfig` with a populated `paso.transactionDataTypes` causes
  `GET /.well-known/openid-credential-issuer/issuers/:tenantId` to include
  `credential_metadata_uri` on that credential's entry; non-PaSO
  credentials omit it.
- `GET <credential_metadata_uri>` with `Accept: application/json,
  Accept-Language: <locale>` returns a JSON `credential_metadata` document
  with `display`, `claims`, and `transaction_data_types` filtered to
  `<locale>`.
- Same URL with `Accept: application/jwt` returns a signed
  `credential-metadata+jwt`:
  - JOSE header `typ=credential-metadata+jwt`, `x5c` equal to the
    credential's attestation chain (proves §6.6 binding);
  - payload `sub` matches `vct` (SD-JWT) or `docType` (mdoc), `iat <= now <
    exp`.
- POSTing a `paso` config with a non-conformant URN key or with
  `value_type` on a claim that lacks `display` is rejected at config
  ingest with HTTP 400.
- `pnpm run gen:api` + `pnpm run gen:sdk` ship the new shapes to
  `schemas/` and `@eudiplo/sdk-core`.
- No file under `apps/backend/src/verifier/` is touched.